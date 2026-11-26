import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateMaintenanceDto, DoneMaintenanceDto, UpdateMaintenanceDto } from './dto';

/** 本地日期字符串，避免 toISOString 在东八区退一天 */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD 加 n 个月；月末自动收回（1/31 + 1 月 → 2/28） */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const base = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

interface PlanRow {
  id: string;
  assetId: string;
  title: string;
  intervalMonths: number;
  lastDoneDate: string | null;
  nextDueDate: string;
  note: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  asset?: { name: string; status: string; deletedAt: Date | null } | null;
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(p: PlanRow) {
    return {
      id: p.id,
      assetId: p.assetId,
      assetName: p.asset?.name ?? '',
      title: p.title,
      intervalMonths: p.intervalMonths,
      lastDoneDate: p.lastDoneDate ?? '',
      nextDueDate: p.nextDueDate,
      daysLeft: daysUntil(p.nextDueDate),
      note: p.note ?? '',
      enabled: p.enabled,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async list(userId: string, headerId: string | undefined, assetId?: string) {
    const { household } = await this.households.resolve(userId, headerId);
    const rows = await this.prisma.maintenancePlan.findMany({
      where: {
        householdId: household.id,
        ...(assetId ? { assetId } : {}),
        asset: { deletedAt: null },
      },
      include: { asset: { select: { name: true, status: true, deletedAt: true } } },
      orderBy: { nextDueDate: 'asc' },
    });
    return rows.map((r) => this.toDto(r as unknown as PlanRow));
  }

  private async ensureAsset(householdId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, householdId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!asset) throw new NotFoundException('资产不存在');
    return asset;
  }

  async create(userId: string, headerId: string | undefined, dto: CreateMaintenanceDto) {
    const { household } = await this.households.resolve(userId, headerId);
    await this.ensureAsset(household.id, dto.assetId);

    const lastDoneDate = dto.lastDoneDate ?? localDateStr(new Date());
    const nextDueDate = dto.nextDueDate ?? addMonths(lastDoneDate, dto.intervalMonths);

    const row = await this.prisma.maintenancePlan.create({
      data: {
        householdId: household.id,
        assetId: dto.assetId,
        title: dto.title,
        intervalMonths: dto.intervalMonths,
        lastDoneDate,
        nextDueDate,
        note: dto.note ?? null,
      },
      include: { asset: { select: { name: true, status: true, deletedAt: true } } },
    });
    return this.toDto(row as unknown as PlanRow);
  }

  async update(userId: string, headerId: string | undefined, id: string, dto: UpdateMaintenanceDto) {
    const { household } = await this.households.resolve(userId, headerId);
    const existing = await this.prisma.maintenancePlan.findFirst({ where: { id, householdId: household.id } });
    if (!existing) throw new NotFoundException('保养计划不存在');

    const intervalMonths = dto.intervalMonths ?? existing.intervalMonths;
    const lastDoneDate = dto.lastDoneDate ?? existing.lastDoneDate ?? undefined;
    const nextDueDate =
      dto.nextDueDate ??
      (dto.intervalMonths !== undefined || dto.lastDoneDate !== undefined
        ? addMonths(lastDoneDate ?? localDateStr(new Date()), intervalMonths)
        : existing.nextDueDate);

    const row = await this.prisma.maintenancePlan.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        intervalMonths,
        lastDoneDate: lastDoneDate ?? null,
        nextDueDate,
        note: dto.note ?? existing.note,
        enabled: dto.enabled ?? existing.enabled,
      },
      include: { asset: { select: { name: true, status: true, deletedAt: true } } },
    });
    return this.toDto(row as unknown as PlanRow);
  }

  /** 打勾「这次做完了」：记下完成日，按周期推到下一次 */
  async done(userId: string, headerId: string | undefined, id: string, dto: DoneMaintenanceDto) {
    const { household } = await this.households.resolve(userId, headerId);
    const existing = await this.prisma.maintenancePlan.findFirst({ where: { id, householdId: household.id } });
    if (!existing) throw new NotFoundException('保养计划不存在');

    const doneDate = dto.doneDate ?? localDateStr(new Date());
    if (doneDate > localDateStr(new Date())) throw new BadRequestException('完成日期不能在未来');

    const row = await this.prisma.maintenancePlan.update({
      where: { id },
      data: { lastDoneDate: doneDate, nextDueDate: addMonths(doneDate, existing.intervalMonths) },
      include: { asset: { select: { name: true, status: true, deletedAt: true } } },
    });
    return this.toDto(row as unknown as PlanRow);
  }

  async remove(userId: string, headerId: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, headerId);
    const existing = await this.prisma.maintenancePlan.findFirst({ where: { id, householdId: household.id } });
    if (!existing) throw new NotFoundException('保养计划不存在');
    await this.prisma.maintenancePlan.delete({ where: { id } });
    return { ok: true };
  }
}
