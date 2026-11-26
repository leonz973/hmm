import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateInsuranceDto, UpdateInsuranceDto } from './dto';

function daysUntil(date: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(`${date}T00:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

@Injectable()
export class InsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(p: {
    id: string;
    name: string;
    kind: string;
    company: string | null;
    coverageFen: number;
    premiumFen: number;
    cycle: string;
    startDate: string;
    endDate: string;
    contact: string | null;
    note: string | null;
    createdAt: Date;
  }) {
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      company: p.company ?? undefined,
      coverageFen: p.coverageFen,
      premiumFen: p.premiumFen,
      cycle: p.cycle,
      startDate: p.startDate,
      endDate: p.endDate,
      contact: p.contact ?? undefined,
      note: p.note ?? undefined,
      daysToEnd: daysUntil(p.endDate),
      createdAt: p.createdAt.toISOString(),
    };
  }

  async list(userId: string, hid?: string) {
    const { household } = await this.households.resolve(userId, hid);
    const rows = await this.prisma.insurancePolicy.findMany({
      where: { householdId: household.id, deletedAt: null },
      orderBy: { endDate: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userId: string, hid: string | undefined, dto: CreateInsuranceDto) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.insurancePolicy.create({
      data: { ...dto, householdId: household.id, coverageFen: dto.coverageFen ?? 0, premiumFen: dto.premiumFen ?? 0, cycle: dto.cycle ?? '每年' },
    });
    return this.toDto(row);
  }

  async update(userId: string, hid: string | undefined, id: string, dto: UpdateInsuranceDto) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.insurancePolicy.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('保单不存在');
    const row = await this.prisma.insurancePolicy.update({ where: { id }, data: { ...dto } });
    return this.toDto(row);
  }

  async remove(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.insurancePolicy.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('保单不存在');
    await this.prisma.insurancePolicy.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
