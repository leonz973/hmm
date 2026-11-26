import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { calcReplacementDate, calcWarrantyEndDate, formatFen, type UsageLevel } from '@hmm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdsService } from '../households/households.service';
import { MailerService } from '../mailer/mailer.service';

export interface ReminderItem {
  type: 'warranty_expire' | 'replacement';
  refId: string;
  assetName: string;
  categoryName: string;
  dueDate: string;
  daysLeft: number;
  severity: 'info' | 'warn' | 'urgent';
  amountFen: number;
}

/** 过了期还没处理的，也继续提醒一段时间，避免“过期即消失” */
const OVERDUE_WINDOW_DAYS = 30;
const DEFAULT_INFLATION = 0.03;

export function daysBetween(from: Date, to: string): number {
  const target = new Date(`${to}T00:00:00`);
  return Math.round((target.getTime() - from.getTime()) / 86_400_000);
}

/** 本地日期（不要用 toISOString：东八区会退一天） */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function severityOf(daysLeft: number): 'info' | 'warn' | 'urgent' {
  if (daysLeft <= 14) return 'urgent';
  if (daysLeft <= 45) return 'warn';
  return 'info';
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdsService,
    private readonly mailer: MailerService,
  ) {}

  /** 按当前日期算出这个家庭该提醒的事项（不落库，纯计算） */
  async collect(householdId: string, warrantyLead: number, replaceLead: number): Promise<ReminderItem[]> {
    const assets = await this.prisma.asset.findMany({
      where: { householdId, deletedAt: null, status: 'in_use' },
      orderBy: { createdAt: 'asc' },
    });

    const now = today();
    const items: ReminderItem[] = [];

    for (const a of assets) {
      const purchaseDate = a.purchaseDate ?? '';
      if (!purchaseDate) continue;
      const usage = (a.usageLevel ?? 'mid') as UsageLevel;

      const warrantyEnd =
        a.warrantyMonths && a.warrantyMonths > 0 ? calcWarrantyEndDate(purchaseDate, a.warrantyMonths) : null;
      if (warrantyEnd) {
        const left = daysBetween(now, warrantyEnd);
        if (left <= warrantyLead && left >= -OVERDUE_WINDOW_DAYS) {
          items.push({
            type: 'warranty_expire',
            refId: a.id,
            assetName: a.name,
            categoryName: a.categoryName ?? '',
            dueDate: warrantyEnd,
            daysLeft: left,
            severity: severityOf(left),
            amountFen: 0,
          });
        }
      }

      const lifeMonths = a.expectedLifeMonths ?? 0;
      const replaceDate =
        a.expectedReplacementDate ??
        (lifeMonths > 0 ? calcReplacementDate(purchaseDate, lifeMonths, usage) : null);
      if (replaceDate) {
        const left = daysBetween(now, replaceDate);
        if (left <= replaceLead && left >= -OVERDUE_WINDOW_DAYS) {
          const years = Math.max(0, (new Date(replaceDate).getTime() - new Date(purchaseDate).getTime()) / (365.25 * 86_400_000));
          const est = Math.round((a.priceFen ?? 0) * Math.pow(1 + DEFAULT_INFLATION, years));
          items.push({
            type: 'replacement',
            refId: a.id,
            assetName: a.name,
            categoryName: a.categoryName ?? '',
            dueDate: replaceDate,
            daysLeft: left,
            severity: severityOf(left),
            amountFen: est,
          });
        }
      }
    }

    return items.sort((x, y) => x.daysLeft - y.daysLeft);
  }

  /** 生成邮件正文：一张清单 + 合计金额 */
  renderEmail(householdName: string, items: ReminderItem[], appUrl?: string): { subject: string; html: string; totalFen: number } {
    const totalFen = items.filter((i) => i.type === 'replacement').reduce((s, i) => s + i.amountFen, 0);
    const rows = items
      .map((i) => {
        const what = i.type === 'warranty_expire' ? '质保到期' : '预计换新';
        const days = i.daysLeft >= 0 ? `还有 ${i.daysLeft} 天` : `已过期 ${-i.daysLeft} 天`;
        const money = i.amountFen ? formatFen(i.amountFen) : '—';
        const color = i.severity === 'urgent' ? '#b91c1c' : i.severity === 'warn' ? '#b45309' : '#334155';
        return `<tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${i.assetName}<div style="color:#94a3b8;font-size:12px;">${i.categoryName}</div></td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${what}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${i.dueDate}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:600;">${days}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${money}</td>
        </tr>`;
      })
      .join('');

    const subject = items.length
      ? `【HMM】${householdName}：${items.length} 项到期提醒，预计需要 ${formatFen(totalFen)} 元`
      : `【HMM】${householdName}：近期没有需要处理的事项`;

    const html = `<!doctype html><html><body style="margin:0;background:#f6f8f5;font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
        <div style="background:#059669;color:#fff;border-radius:16px 16px 0 0;padding:20px 24px;">
          <div style="font-size:13px;opacity:.85;">HMM 家庭资产管家</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;">${householdName} · 到期提醒</div>
        </div>
        <div style="background:#fff;border-radius:0 0 16px 16px;padding:20px 24px;">
          <p style="margin:0 0 16px;color:#334155;font-size:14px;">
            共 ${items.length} 项需要留意，其中换新预估合计
            <strong style="color:#059669;">${formatFen(totalFen)} 元</strong>。提前规划，换的时候不慌。
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
            <thead><tr style="text-align:left;color:#64748b;font-size:12px;">
              <th style="padding:6px 8px;">资产</th><th style="padding:6px 8px;">事项</th>
              <th style="padding:6px 8px;">日期</th><th style="padding:6px 8px;">剩余</th>
              <th style="padding:6px 8px;text-align:right;">预估金额</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${appUrl ? `<p style="margin:20px 0 0;"><a href="${appUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;">打开 HMM 查看详情</a></p>` : ''}
          <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;">这封邮件由 HMM 每天 06:00 自动发送。可在「我的 → 提醒设置」里调整提前天数。</p>
        </div>
      </div>
    </body></html>`;

    return { subject, html, totalFen };
  }

  /** 跑一次：算 → 去重落库 → 发邮件 */
  async run(householdId: string, options: { trigger: 'cron' | 'manual'; dryRun?: boolean }) {
    const household = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!household) return { items: [], created: 0, sent: 0, status: 'skipped' as const };

    const items = await this.collect(household.id, household.warrantyLeadDays, household.replaceLeadDays);
    const { subject, html } = this.renderEmail(household.name, items, process.env.APP_URL);
    const todayStr = localDateStr(today());

    let created = 0;
    if (!options.dryRun) {
      const existing = await this.prisma.reminder.findMany({
        where: { householdId: household.id, fireDate: todayStr },
        select: { type: true, refId: true },
      });
      const seen = new Set(existing.map((e) => `${e.type}:${e.refId}`));

      for (const item of items) {
        if (seen.has(`${item.type}:${item.refId}`)) continue;
        try {
          await this.prisma.reminder.create({
            data: {
              householdId: household.id,
              type: item.type,
              refId: item.refId,
              fireDate: todayStr,
              severity: item.severity,
              payload: JSON.stringify(item),
            },
          });
          created += 1;
        } catch {
          /* 并发下唯一键冲突忽略 */
        }
      }
    }

    let sent = 0;
    let status: 'ok' | 'skipped' | 'failed' = 'ok';
    let message: string | undefined;

    if (!options.dryRun && items.length && household.notifyEmail) {
      const owner = await this.prisma.user.findUnique({ where: { id: household.ownerUserId } });
      if (owner?.email) {
        const result = await this.mailer.send(owner.email, subject, html);
        if (result.sent) {
          sent = 1;
          await this.prisma.reminder.updateMany({
            where: { householdId: household.id, fireDate: todayStr },
            data: { sentEmailAt: new Date(), emailTo: owner.email },
          });
        } else {
          status = result.skipped ? 'skipped' : 'failed';
          message = result.reason;
        }
      }
    } else if (options.dryRun) {
      status = 'skipped';
      message = 'dryRun';
    }

    if (!options.dryRun) {
      await this.prisma.reminderRunLog.create({
        data: {
          householdId: household.id,
          runDate: todayStr,
          trigger: options.trigger,
          found: items.length,
          created,
          sent,
          status,
          message,
        },
      });
    }

    return { items, subject, html: options.dryRun ? html : undefined, created, sent, status, message };
  }

  async listForUser(userId: string, hid?: string) {
    const { household } = await this.households.resolve(userId, hid);
    const items = await this.collect(household.id, household.warrantyLeadDays, household.replaceLeadDays);
    const logs = await this.prisma.reminderRunLog.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return {
      items,
      warrantyLeadDays: household.warrantyLeadDays,
      replaceLeadDays: household.replaceLeadDays,
      notifyEmail: household.notifyEmail,
      smtpConfigured: this.mailer.isConfigured,
      lastRuns: logs.map((l) => ({ runDate: l.runDate, found: l.found, sent: l.sent, status: l.status, message: l.message })),
    };
  }

  /** 每天 06:00（北京时间）给所有家庭算一遍并发邮件 */
  @Cron('0 6 * * *', { timeZone: 'Asia/Shanghai' })
  async dailyRun() {
    const households = await this.prisma.household.findMany({
      where: { deletedAt: null, notifyEmail: true },
      select: { id: true, name: true },
    });
    this.logger.log(`每日提醒开始：${households.length} 个家庭`);
    for (const h of households) {
      try {
        const res = await this.run(h.id, { trigger: 'cron' });
        this.logger.log(`${h.name}: ${res.items.length} 项，发送 ${res.sent} 封（${res.status}）`);
      } catch (e) {
        this.logger.error(`${h.name} 提醒失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
