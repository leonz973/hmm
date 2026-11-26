import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateSavingGoalDto, UpdateSavingGoalDto } from './dto';

@Injectable()
export class SavingGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(g: {
    id: string;
    name: string;
    targetFen: number;
    savedFen: number;
    targetDate: string;
    linkedAssetId: string | null;
    note: string | null;
    createdAt: Date;
  }) {
    return {
      id: g.id,
      name: g.name,
      targetFen: g.targetFen,
      savedFen: g.savedFen,
      targetDate: g.targetDate,
      linkedAssetId: g.linkedAssetId ?? undefined,
      note: g.note ?? undefined,
      createdAt: g.createdAt.toISOString(),
    };
  }

  async list(userId: string, hid?: string) {
    const { household } = await this.households.resolve(userId, hid);
    const rows = await this.prisma.savingGoal.findMany({
      where: { householdId: household.id, deletedAt: null },
      orderBy: { targetDate: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userId: string, hid: string | undefined, dto: CreateSavingGoalDto) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.savingGoal.create({
      data: { ...dto, householdId: household.id, savedFen: dto.savedFen ?? 0 },
    });
    return this.toDto(row);
  }

  async update(userId: string, hid: string | undefined, id: string, dto: UpdateSavingGoalDto) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.savingGoal.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('储蓄目标不存在');
    const row = await this.prisma.savingGoal.update({ where: { id }, data: { ...dto } });
    return this.toDto(row);
  }

  async remove(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.savingGoal.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('储蓄目标不存在');
    await this.prisma.savingGoal.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
