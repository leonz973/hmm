import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MailResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
}

/** 极简邮件发送：没配 SMTP 时不报错，只记一条日志（本地开发友好） */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get('SMTP_HOST') && this.config.get('SMTP_USER') && this.config.get('SMTP_PASS'));
  }

  private get transport(): Transporter {
    if (!this.transporter) {
      const port = Number(this.config.get('SMTP_PORT') ?? 465);
      this.transporter = nodemailer.createTransport({
        host: this.config.get('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  /** 没配 SMTP 时把邮件落到磁盘，便于本地预览版式与内容 */
  private savePreview(to: string, subject: string, html: string): string {
    const dir = this.config.get('MAIL_PREVIEW_DIR') ?? join(process.cwd(), '.mail-out');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `${stamp}.html`);
    const banner = `<div style="font:13px/1.6 sans-serif;padding:10px 14px;background:#fff7ed;color:#9a3412">开发预览 · 收件人 ${to} · 主题 ${subject}</div>`;
    writeFileSync(file, banner + html, 'utf8');
    return file;
  }

  async send(to: string, subject: string, html: string): Promise<MailResult> {
    if (!this.isConfigured) {
      const file = this.savePreview(to, subject, html);
      this.logger.warn(`SMTP 未配置，邮件已写入预览：${file}`);
      return { sent: false, skipped: true, reason: `SMTP 未配置（已写入预览 ${file}）` };
    }
    try {
      await this.transport.sendMail({
        from: this.config.get('SMTP_FROM') ?? this.config.get('SMTP_USER'),
        to,
        subject,
        html,
      });
      return { sent: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.error(`邮件发送失败：${reason}`);
      return { sent: false, reason };
    }
  }
}
