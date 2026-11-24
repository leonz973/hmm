import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateBillDto, UpdateBillDto } from './dto';

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(b: {
    id: string;
    type: string;
    period: string | null;
    amountFen: number;
    usage: string | null;
    dueDate: string | null;
    paidDate: string | null;
    note: string | null;
    createdAt: Date;
  }) {
    return {
      id: b.id,
      type: b.type,
      period: b.period ?? '',
      amountFen: b.amountFen,
      usage: b.usage ?? undefined,
      dueDate: b.dueDate ?? '',
      paidDate: b.paidDate ?? undefined,
      note: b.note ?? undefined,
      createdAt: b.createdAt.toISOString(),
    };
  }

  async list(userId: string, hid?: string) {
    const { household } = await this.households.resolve(userId, hid);
    const rows = await this.prisma.utilityBill.findMany({
      where: { householdId: household.id, deletedAt: null },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userId: string, hid: string | undefined, dto: CreateBillDto) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.utilityBill.create({
      data: {
        householdId: household.id,
        type: dto.type,
        period: dto.period,
        periodStart: `${dto.period}-01`,
        periodEnd: `${dto.period}-28`,
        amountFen: dto.amountFen,
        usage: dto.usage,
        dueDate: dto.dueDate,
        note: dto.note,
        createdBy: userId,
      },
    });
    return this.toDto(row);
  }

  async update(userId: string, hid: string | undefined, id: string, dto: UpdateBillDto) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.utilityBill.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('账单不存在');
    const row = await this.prisma.utilityBill.update({ where: { id }, data: { ...dto } });
    return this.toDto(row);
  }

  async setPaid(userId: string, hid: string | undefined, id: string, paid: boolean) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.utilityBill.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('账单不存在');
    const row = await this.prisma.utilityBill.update({
      where: { id },
      data: { paidDate: paid ? new Date().toISOString().slice(0, 10) : null },
    });
    return this.toDto(row);
  }

  async remove(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.utilityBill.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('账单不存在');
    await this.prisma.utilityBill.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
