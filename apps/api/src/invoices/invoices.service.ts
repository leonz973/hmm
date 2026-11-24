import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';

interface StoredFile {
  name?: string;
  type?: string;
  size?: number;
  key?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
  ) {}

  private toDto(i: {
    id: string;
    merchant: string | null;
    title: string | null;
    amountFen: number | null;
    invoiceDate: string | null;
    kind: string | null;
    invoiceNo: string | null;
    note: string | null;
    files: string;
    createdAt: Date;
    assets?: Array<{ assetId: string }>;
  }) {
    let file: StoredFile | null = null;
    try {
      const parsed = JSON.parse(i.files || '[]');
      file = Array.isArray(parsed) && parsed.length ? parsed[0] : null;
    } catch {
      file = null;
    }

    return {
      id: i.id,
      seller: i.merchant ?? '',
      title: i.title ?? '',
      amountFen: i.amountFen ?? 0,
      date: i.invoiceDate ?? '',
      kind: i.kind ?? '',
      number: i.invoiceNo ?? undefined,
      assetIds: (i.assets ?? []).map((a) => a.assetId),
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      blobKey: file?.key,
      note: i.note ?? undefined,
      createdAt: i.createdAt.toISOString(),
    };
  }

  async list(userId: string, hid?: string) {
    const { household } = await this.households.resolve(userId, hid);
    const rows = await this.prisma.invoice.findMany({
      where: { householdId: household.id, deletedAt: null },
      include: { assets: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  private filesJson(dto: { fileName?: string; fileType?: string; fileSize?: number; blobKey?: string }) {
    if (!dto.fileName) return '[]';
    return JSON.stringify([
      { name: dto.fileName, type: dto.fileType, size: dto.fileSize, key: dto.blobKey },
    ]);
  }

  async create(userId: string, hid: string | undefined, dto: CreateInvoiceDto) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.invoice.create({
      data: {
        householdId: household.id,
        merchant: dto.seller,
        title: dto.title,
        amountFen: dto.amountFen,
        invoiceDate: dto.date,
        kind: dto.kind,
        invoiceNo: dto.number,
        note: dto.note,
        files: this.filesJson(dto),
        createdBy: userId,
        assets: dto.assetIds?.length
          ? { create: dto.assetIds.map((assetId) => ({ assetId })) }
          : undefined,
      },
      include: { assets: true },
    });
    return this.toDto(row);
  }

  async update(userId: string, hid: string | undefined, id: string, dto: UpdateInvoiceDto) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.invoice.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('发票不存在');

    if (dto.assetIds) {
      await this.prisma.invoiceAsset.deleteMany({ where: { invoiceId: id } });
      if (dto.assetIds.length) {
        await this.prisma.invoiceAsset.createMany({
          data: dto.assetIds.map((assetId) => ({ invoiceId: id, assetId })),
        });
      }
    }

    const row = await this.prisma.invoice.update({
      where: { id },
      data: {
        merchant: dto.seller,
        title: dto.title,
        amountFen: dto.amountFen,
        invoiceDate: dto.date,
        kind: dto.kind,
        invoiceNo: dto.number,
        note: dto.note,
        ...(dto.fileName ? { files: this.filesJson(dto) } : {}),
      },
      include: { assets: true },
    });
    return this.toDto(row);
  }

  async remove(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const found = await this.prisma.invoice.findFirst({
      where: { id, householdId: household.id, deletedAt: null },
    });
    if (!found) throw new NotFoundException('发票不存在');
    await this.prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
