import { Injectable, NotFoundException } from '@nestjs/common';
import { calcReplacementDate, calcWarrantyEndDate, type UsageLevel } from '@hmm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateAssetDto, UpdateAssetDto } from './dto';

/** 与前端 StoredAsset 对齐的返回结构 */
interface AssetRow {
  id: string;
  name: string;
  categoryKey: string | null;
  categoryName: string | null;
  locationName: string | null;
  purchaseDate: string | null;
  priceFen: number | null;
  warrantyMonths: number | null;
  expectedLifeMonths: number | null;
  usageLevel: string | null;
  note: string | null;
  expectedReplacementDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(a: AssetRow) {
    const purchaseDate = a.purchaseDate ?? '';
    const warrantyMonths = a.warrantyMonths ?? 0;
    const lifeMonths = a.expectedLifeMonths ?? 0;
    const usage = (a.usageLevel ?? 'mid') as UsageLevel;

    const warrantyEndDate =
      purchaseDate && warrantyMonths > 0 ? calcWarrantyEndDate(purchaseDate, warrantyMonths) : null;
    const expectedReplaceDate =
      a.expectedReplacementDate ??
      (purchaseDate && lifeMonths > 0 ? calcReplacementDate(purchaseDate, lifeMonths, usage) : null);

    return {
      id: a.id,
      name: a.name,
      categoryKey: a.categoryKey ?? '',
      categoryName: a.categoryName ?? '',
      location: a.locationName ?? '',
      purchaseDate,
      priceFen: a.priceFen ?? 0,
      warrantyMonths,
      expectedLifeMonths: lifeMonths,
      usageLevel: usage,
      notes: a.note ?? '',
      warrantyEndDate,
      expectedReplaceDate,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async list(userId: string, headerId?: string) {
    const { household } = await this.households.resolve(userId, headerId);
    const rows = await this.prisma.asset.findMany({
      where: { householdId: household.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r as unknown as AssetRow));
  }

  async create(userId: string, headerId: string | undefined, dto: CreateAssetDto) {
    const { household } = await this.households.resolve(userId, headerId);
    const row = await this.prisma.asset.create({
      data: {
        householdId: household.id,
        createdBy: userId,
        name: dto.name.trim(),
        categoryKey: dto.categoryKey,
        categoryName: dto.categoryName,
        locationName: dto.location,
        purchaseDate: dto.purchaseDate,
        priceFen: dto.priceFen,
        warrantyMonths: dto.warrantyMonths,
        expectedLifeMonths: dto.expectedLifeMonths,
        usageLevel: dto.usageLevel ?? 'mid',
        note: dto.note,
      },
    });
    return this.toDto(row as unknown as AssetRow);
  }

  async update(userId: string, headerId: string | undefined, id: string, dto: UpdateAssetDto) {
    const { household } = await this.households.resolve(userId, headerId);
    const found = await this.prisma.asset.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('资产不存在');

    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        categoryKey: dto.categoryKey,
        categoryName: dto.categoryName,
        locationName: dto.location,
        purchaseDate: dto.purchaseDate,
        priceFen: dto.priceFen,
        warrantyMonths: dto.warrantyMonths,
        expectedLifeMonths: dto.expectedLifeMonths,
        usageLevel: dto.usageLevel,
        note: dto.note,
      },
    });
    return this.toDto(row as unknown as AssetRow);
  }

  /** 软删除：留痕，误删可从数据库恢复 */
  async remove(userId: string, headerId: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, headerId);
    const found = await this.prisma.asset.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('资产不存在');

    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
