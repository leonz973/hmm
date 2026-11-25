import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Headers,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayloadUser } from '../auth/current-user.decorator';
import { InvoicesService } from '../invoices/invoices.service';

@Controller('attachments')
@UseGuards(AuthGuard('jwt'))
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly invoices: InvoicesService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Body() body: { entity?: string; entityId?: string },
    @CurrentUser() user: JwtPayloadUser,
    @Headers('x-household-id') hid?: string,
  ) {
    if (!file) throw new BadRequestException('没有收到文件');
    if (!body?.entity || !body?.entityId) throw new BadRequestException('缺少 entity / entityId');

    const result = await this.attachments.save(user.userId, hid, file, body.entity, body.entityId);
    const invoice = result.invoice
      ? this.invoices.toDto(result.invoice as Parameters<InvoicesService['toDto']>[0])
      : null;
    return { attachment: result.attachment, invoice };
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Res() res: Response,
    @Headers('x-household-id') hid?: string,
  ) {
    const { row, path } = await this.attachments.find(user.userId, hid, id);
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('Content-Length', String(row.size));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(path);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.attachments.remove(user.userId, hid, id);
  }
}
