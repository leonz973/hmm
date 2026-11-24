import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析当前家庭：优先用请求头 x-household-id，否则用用户加入的第一个家庭。
   * 多家庭是后续能力，MVP 里绝大多数用户只有一个。
   */
  async resolve(userId: string, headerId?: string) {
    if (headerId) {
      const m = await this.prisma.membership.findUnique({
        where: { userId_householdId: { userId, householdId: headerId } },
        include: { household: true },
      });
      if (!m || m.household.deletedAt) throw new ForbiddenException('你不在这个家庭里');
      return { membership: m, household: m.household };
    }

    const m = await this.prisma.membership.findFirst({
      where: { userId, household: { deletedAt: null } },
      include: { household: true },
      orderBy: { joinedAt: 'asc' },
    });
    if (!m) throw new NotFoundException('还没有家庭');
    return { membership: m, household: m.household };
  }

  async current(userId: string, headerId?: string) {
    const { membership, household } = await this.resolve(userId, headerId);
    const members = await this.prisma.membership.findMany({
      where: { householdId: household.id },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      id: household.id,
      name: household.name,
      role: membership.role,
      createdAt: household.createdAt,
      members: members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  async rename(userId: string, headerId: string | undefined, name: string) {
    const { membership, household } = await this.resolve(userId, headerId);
    if (membership.role !== 'owner') throw new ForbiddenException('只有户主能改家庭名');
    const updated = await this.prisma.household.update({
      where: { id: household.id },
      data: { name: name.trim() },
    });
    return { id: updated.id, name: updated.name };
  }

  /** 邀请码：一次生成 8 位，72 小时有效，重新生成会让旧码失效 */
  async createInvite(userId: string, headerId?: string) {
    const { membership, household } = await this.resolve(userId, headerId);
    if (membership.role !== 'owner') throw new ForbiddenException('只有户主能邀请成员');

    const code = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
    const expiresAt = new Date(Date.now() + 72 * 3600_000);
    await this.prisma.household.update({
      where: { id: household.id },
      data: { inviteCode: code, inviteExp: expiresAt },
    });

    return { code, expiresAt };
  }

  async join(userId: string, code: string) {
    const normalized = code.trim().toUpperCase();
    const household = await this.prisma.household.findUnique({
      where: { inviteCode: normalized },
    });
    if (!household || household.deletedAt) throw new BadRequestException('邀请码无效');
    if (household.inviteExp && household.inviteExp < new Date()) {
      throw new BadRequestException('邀请码已过期，请让户主重新生成');
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_householdId: { userId, householdId: household.id } },
    });
    if (existing) return { householdId: household.id, name: household.name, already: true };

    await this.prisma.membership.create({
      data: { userId, householdId: household.id, role: 'member' },
    });
    return { householdId: household.id, name: household.name, already: false };
  }
}
