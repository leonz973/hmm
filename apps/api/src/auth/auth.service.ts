import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshDays(): number {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const m = /^(\d+)d$/.exec(ttl);
    return m ? Number(m[1]) : 30;
  }

  private async issue(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret',
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      },
    );

    const raw = randomBytes(32).toString('hex');
    const days = this.refreshDays();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + days * 86400_000),
      },
    });

    return { accessToken, refreshToken: raw, expiresIn: 15 * 60 };
  }

  /**
   * 注册即建家：新用户自动成为「我的家」的户主。
   * 这样登录进去不是一个空壳，而是已经有地方可以放资产。
   */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('这个邮箱已经注册过了');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const displayName = dto.displayName.trim();
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName },
    });

    // 户主字段是必填，所以先建用户，再在同一个事务里建家和成员关系
    await this.prisma.$transaction([
      this.prisma.household.create({
        data: {
          name: `${displayName}的家`,
          ownerUserId: user.id,
          memberships: { create: { userId: user.id, role: 'owner' } },
        },
      }),
    ]);

    return {
      user: this.toAuthUser(user),
      ...(await this.issue(user.id, user.email)),
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('邮箱或密码不对');

    const ok = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) throw new UnauthorizedException('邮箱或密码不对');

    return {
      user: this.toAuthUser(user),
      ...(await this.issue(user.id, user.email)),
    };
  }

  /** 刷新时轮换：旧的立刻作废，避免 token 被重放 */
  async refresh(raw: string) {
    const rec = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(raw) },
    });
    if (!rec || rec.revokedAt || rec.expiresAt < new Date()) {
      throw new UnauthorizedException('登录状态已过期，请重新登录');
    }

    await this.prisma.refreshToken.update({
      where: { id: rec.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: rec.userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    return { user: this.toAuthUser(user), ...(await this.issue(user.id, user.email)) };
  }

  async logout(raw: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { household: true } } },
    });
    if (!user) throw new UnauthorizedException('用户不存在');

    return {
      user: this.toAuthUser(user),
      households: user.memberships.map((m) => ({
        id: m.householdId,
        name: m.household.name,
        role: m.role,
      })),
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    displayName: string;
    emailVerifiedAt: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
