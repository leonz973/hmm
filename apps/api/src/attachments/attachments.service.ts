import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';

export const ATTACHMENT_ENTITIES = ['invoice', 'asset', 'bill'] as const;

interface StoredFile {
  name?: string;
  type?: string;
  size?: number;
  key?: string;
}

/** 附件落盘（本地磁盘；将来换 MinIO 只改这一层的 put/get/remove） */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
    private readonly config: ConfigService,
  ) {
    this.root = resolve(this.config.get('STORAGE_DIR') ?? join(process.cwd(), 'storage'));
    mkdirSync(join(this.root, 'attachments'), { recursive: true });
  }

  /** 生成落盘用的相对 key（不含目录），保留扩展名便于直接在浏览器里识别 */
  newObjectKey(originalName: string): string {
    const ext = (originalName.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? '').toLowerCase();
    return `${randomUUID()}${ext}`;
  }

  absPath(objectKey: string): string {
    return join(this.root, 'attachments', objectKey);
  }

  private async assertEntity(userId: string, hid: string | undefined, entity: string, entityId: string) {
    const { household } = await this.households.resolve(userId, hid);
    if (!ATTACHMENT_ENTITIES.includes(entity as (typeof ATTACHMENT_ENTITIES)[number])) {
      throw new BadRequestException(`不支持的附件类型：${entity}`);
    }
    if (entity === 'invoice') {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: entityId, householdId: household.id, deletedAt: null },
      });
      if (!inv) throw new NotFoundException('发票不存在');
    }
    return household;
  }

  async save(
    userId: string,
    hid: string | undefined,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    entity: string,
    entityId: string,
  ) {
    const household = await this.assertEntity(userId, hid, entity, entityId);

    const objectKey = this.newObjectKey(file.originalname);
    writeFileSync(this.absPath(objectKey), file.buffer);

    const row = await this.prisma.attachment.create({
      data: {
        householdId: household.id,
        objectKey,
        mime: file.mimetype,
        size: file.size,
        entity,
        entityId,
      },
    });

    // 发票只挂一个附件：写回 Invoice.files，前端读 blobKey 就能拿到
    let invoice: unknown = null;
    if (entity === 'invoice') {
      const inv = await this.prisma.invoice.findUnique({ where: { id: entityId } });
      const list: StoredFile[] = [{ name: file.originalname, type: file.mimetype, size: file.size, key: row.id }];
      const updated = await this.prisma.invoice.update({
        where: { id: entityId },
        data: { files: JSON.stringify(list) },
        include: { assets: true },
      });
      invoice = updated;
    }

    this.logger.log(`附件已保存：${entity}/${entityId} → ${row.id} (${file.size}B)`);
    return { attachment: { id: row.id, name: file.originalname, type: file.mimetype, size: file.size }, invoice };
  }

  async find(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.attachment.findFirst({ where: { id, householdId: household.id } });
    if (!row) throw new NotFoundException('附件不存在');
    const path = this.absPath(row.objectKey);
    if (!existsSync(path)) throw new NotFoundException('附件文件缺失');
    return { row, path };
  }

  async remove(userId: string, hid: string | undefined, id: string) {
    const { household } = await this.households.resolve(userId, hid);
    const row = await this.prisma.attachment.findFirst({ where: { id, householdId: household.id } });
    if (!row) throw new NotFoundException('附件不存在');

    await this.prisma.attachment.delete({ where: { id: row.id } });
    try {
      const path = this.absPath(row.objectKey);
      if (existsSync(path)) unlinkSync(path);
    } catch (e) {
      this.logger.warn(`删除附件文件失败：${(e as Error).message}`);
    }
    if (row.entity === 'invoice') {
      await this.prisma.invoice.update({ where: { id: row.entityId }, data: { files: '[]' } }).catch(() => null);
    }
    return { ok: true };
  }
}
