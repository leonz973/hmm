import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateFixedExpenseDto, UpdateFixedExpenseDto } from './dto';

@Injectable()
export class FixedExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(f: {
    id: string;
    name: string;
    amountFen: number;
    cycle: string;
    dueDate: string;
    category: string | null;
    autoPay: boolean;
    note: string | null;
    createdAt: Date;
  }) {
    return {
      id: f.id,
      name: f.name,
      amountFen: f.amountFen,
      cycle: f.cycle,
      dueDate: f.dueDate,
      category: f.category ?? '',
      autoPay: f.autoPay,
      note: f.note ?? undefined,
      createdAt: f.createdAt.toISOString(),
    };
  }

  async list(userId: string, hid?: string) {
    const { household } = await this.households.resolve(userId, hid);
    const rows = await this.prisma.fixedExpense.findMany({
      where: { householdId: household.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userId: string, hid: string | undefined, dto: CreateFixedExpenseDto) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.fixedExpense.create({
      data: {
        householdId: household.id,
        name: dto.name,
        amountFen: dto.amountFen,
        cycle: dto.cycle,
        dueDate: dto.dueDate,
        category: dto.category,
        autoPay: dto.autoPay ?? false,
        note: dto.note,
      },
    });
    return this.toDto(row);
  }

  async update(userId: string, hid: string | undefined, id: string, dto: UpdateFixedExpenseDto) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.fixedExpense.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('支出不存在');
    const row = await this.prisma.fixedExpense.update({ where: { id }, data: { ...dto } });
    return this.toDto(row);
  }

  async remove(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.fixedExpense.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('支出不存在');
    await this.prisma.fixedExpense.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
