/**
 * 数据导出 / 导入。
 * 数据来源改走 Pinia store（而不是 localStorage）：
 * - 本地模式：store 本身就是 localStorage 的镜像
 * - 云模式：store 里是服务端数据，导出才有意义
 * 导入时本地模式写 localStorage，云模式逐条调 API 写进当前家庭。
 */
import { api } from '@/lib/api';
import type { AssetPayload, BillPayload, FixedExpensePayload, InvoicePayload } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useAssetsStore } from '@/stores/assets';
import { useBillsStore } from '@/stores/bills';
import { useFixedExpensesStore } from '@/stores/fixedExpenses';
import { useInvoicesStore } from '@/stores/invoices';
import { todayISO } from '@/lib/persist';

export const STORAGE_KEYS = {
  assets: 'hmm.assets.v1',
  fixedExpenses: 'hmm.fixedExpenses.v1',
  bills: 'hmm.bills.v1',
  invoices: 'hmm.invoices.v1',
} as const;

export type DataKey = keyof typeof STORAGE_KEYS;

export interface BackupFile {
  app: 'hmm';
  version: 1;
  exportedAt: string;
  data: Record<DataKey, unknown[]>;
}

function collect(): Record<DataKey, unknown[]> {
  const assets = useAssetsStore();
  const fixed = useFixedExpensesStore();
  const bills = useBillsStore();
  const invoices = useInvoicesStore();
  if (!assets.loaded) assets.load();
  fixed.load();
  bills.load();
  invoices.load();
  return {
    assets: assets.items,
    fixedExpenses: fixed.items,
    bills: bills.items,
    invoices: invoices.items,
  };
}

export function collectBackup(): BackupFile {
  return { app: 'hmm', version: 1, exportedAt: new Date().toISOString(), data: collect() };
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(): void {
  const stamp = new Date().toISOString().slice(0, 10);
  download(`hmm-backup-${stamp}.json`, JSON.stringify(collectBackup(), null, 2), 'application/json');
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')).join('\n');
  // BOM：Excel 打开中文不乱码
  return `\uFEFF${head}\n${body}`;
}

export function exportAssetsCSV(): void {
  const assets = useAssetsStore();
  if (!assets.loaded) assets.load();
  const rows = assets.items.map((a) => ({
    名称: a.name ?? '',
    品类: a.categoryName ?? '',
    房间: a.location ?? '',
    购买日期: a.purchaseDate ?? '',
    价格元: ((a.priceFen ?? 0) / 100).toFixed(2),
    质保月: a.warrantyMonths ?? 0,
    预计寿命月: a.expectedLifeMonths ?? 0,
    使用强度: a.usageLevel ?? '',
    状态: a.status === 'replaced' ? '已换新' : '在用',
  }));
  const stamp = new Date().toISOString().slice(0, 10);
  download(
    `hmm-assets-${stamp}.csv`,
    toCSV(rows, ['名称', '品类', '房间', '购买日期', '价格元', '质保月', '预计寿命月', '使用强度', '状态']),
    'text/csv;charset=utf-8',
  );
}

export interface ImportResult {
  ok: boolean;
  message: string;
  counts?: Record<DataKey, number>;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

async function importToCloud(data: Record<string, unknown[]>): Promise<ImportResult> {
  const counts: Record<DataKey, number> = { assets: 0, fixedExpenses: 0, bills: 0, invoices: 0 };
  const failed: string[] = [];

  for (const raw of asArray(data.assets)) {
    const name = String(raw.name ?? '').trim();
    if (!name) continue;
    try {
      const payload: AssetPayload = {
        name,
        categoryKey: raw.categoryKey ? String(raw.categoryKey) : undefined,
        categoryName: raw.categoryName ? String(raw.categoryName) : undefined,
        location: raw.location ? String(raw.location) : undefined,
        purchaseDate: raw.purchaseDate ? String(raw.purchaseDate) : todayISO(),
        priceFen: Number(raw.priceFen ?? 0),
        warrantyMonths: Number(raw.warrantyMonths ?? 0),
        expectedLifeMonths: Number(raw.expectedLifeMonths ?? 0),
        usageLevel: (raw.usageLevel as AssetPayload['usageLevel']) ?? 'mid',
        note: raw.note ? String(raw.note) : undefined,
      };
      await api.createAsset(payload);
      counts.assets += 1;
    } catch {
      failed.push(`资产「${name}」`);
    }
  }

  for (const raw of asArray(data.fixedExpenses)) {
    const name = String(raw.name ?? '').trim();
    if (!name) continue;
    try {
      const payload: FixedExpensePayload = {
        name,
        amountFen: Number(raw.amountFen ?? 0),
        cycle: String(raw.cycle ?? '每月'),
        dueDate: String(raw.dueDate ?? todayISO()),
        category: raw.category ? String(raw.category) : undefined,
        autoPay: Boolean(raw.autoPay),
        note: raw.note ? String(raw.note) : undefined,
      };
      await api.createFixedExpense(payload);
      counts.fixedExpenses += 1;
    } catch {
      failed.push(`固定支出「${name}」`);
    }
  }

  for (const raw of asArray(data.bills)) {
    const type = String(raw.type ?? '').trim();
    const period = String(raw.period ?? '').trim();
    if (!type || !period) continue;
    try {
      const payload: BillPayload = {
        type,
        period,
        amountFen: Number(raw.amountFen ?? 0),
        usage: raw.usage === undefined ? undefined : String(raw.usage),
        dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
        note: raw.note ? String(raw.note) : undefined,
      };
      await api.createBill(payload);
      counts.bills += 1;
    } catch {
      failed.push(`账单「${type} ${period}」`);
    }
  }

  for (const raw of asArray(data.invoices)) {
    const seller = String(raw.seller ?? '').trim();
    if (!seller) continue;
    try {
      const payload: InvoicePayload = {
        seller,
        title: raw.title ? String(raw.title) : undefined,
        amountFen: Number(raw.amountFen ?? 0),
        date: String(raw.date ?? todayISO()),
        kind: raw.kind ? String(raw.kind) : undefined,
        number: raw.number ? String(raw.number) : undefined,
        note: raw.note ? String(raw.note) : undefined,
      };
      await api.createInvoice(payload);
      counts.invoices += 1;
    } catch {
      failed.push(`发票「${seller}」`);
    }
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const detail = `资产 ${counts.assets} / 固定支出 ${counts.fixedExpenses} / 账单 ${counts.bills} / 发票 ${counts.invoices}`;
  return {
    ok: failed.length === 0,
    message: failed.length
      ? `已导入 ${total} 条（${detail}），${failed.length} 条失败：${failed.slice(0, 3).join('、')}`
      : `已导入 ${total} 条（${detail}）`,
    counts,
  };
}

function importToLocal(data: Record<string, unknown[]>, mode: 'replace' | 'merge'): ImportResult {
  const counts = {} as Record<DataKey, number>;
  for (const [name, key] of Object.entries(STORAGE_KEYS) as Array<[DataKey, string]>) {
    const incoming = data[name];
    if (!Array.isArray(incoming)) {
      counts[name] = 0;
      continue;
    }
    if (mode === 'replace') {
      localStorage.setItem(key, JSON.stringify(incoming));
      counts[name] = incoming.length;
      continue;
    }
    // merge：按 id 去重，已有的 id 保留本地版本
    let existing: Array<{ id?: string }> = [];
    try {
      existing = JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      existing = [];
    }
    const ids = new Set(existing.map((x) => x.id).filter(Boolean));
    const merged = [...existing];
    for (const item of incoming as Array<{ id?: string }>) {
      if (item?.id && ids.has(item.id)) continue;
      merged.push(item);
    }
    localStorage.setItem(key, JSON.stringify(merged));
    counts[name] = merged.length;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return { ok: true, message: `导入完成，共 ${total} 条，刷新页面后生效`, counts };
}

export async function importJSON(text: string, mode: 'replace' | 'merge' = 'merge'): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: '文件不是合法的 JSON' };
  }
  const file = parsed as Partial<BackupFile>;
  if (!file || typeof file !== 'object' || !('data' in file)) {
    return { ok: false, message: '这不是 HMM 导出的备份文件（缺少 data 字段）' };
  }
  const data = (file.data ?? {}) as Record<string, unknown[]>;
  const auth = useAuthStore();
  if (auth.isCloud) return importToCloud(data);
  return importToLocal(data, mode);
}

/** 只清本机数据；云端数据请在服务器侧备份/删除 */
export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key);
}
