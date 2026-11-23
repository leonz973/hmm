/**
 * 数据导出 / 导入。
 * 前端阶段数据都在 localStorage，导出成 JSON 就是最实在的备份；
 * 接后端前，这份文件也是迁移到云端的输入。
 */

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

export function collectBackup(): BackupFile {
  const data = {} as Record<DataKey, unknown[]>;
  for (const [name, key] of Object.entries(STORAGE_KEYS) as Array<[DataKey, string]>) {
    try {
      data[name] = JSON.parse(localStorage.getItem(key) ?? '[]');
    } catch {
      data[name] = [];
    }
  }
  return { app: 'hmm', version: 1, exportedAt: new Date().toISOString(), data };
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
  type Asset = {
    name?: string;
    categoryName?: string;
    location?: string;
    purchaseDate?: string;
    priceFen?: number;
    warrantyMonths?: number;
    expectedLifeMonths?: number;
    usageLevel?: string;
  };
  let assets: Asset[] = [];
  try {
    assets = JSON.parse(localStorage.getItem(STORAGE_KEYS.assets) ?? '[]');
  } catch {
    assets = [];
  }
  const rows = assets.map((a) => ({
    名称: a.name ?? '',
    品类: a.categoryName ?? '',
    房间: a.location ?? '',
    购买日期: a.purchaseDate ?? '',
    价格元: ((a.priceFen ?? 0) / 100).toFixed(2),
    质保月: a.warrantyMonths ?? 0,
    预计寿命月: a.expectedLifeMonths ?? 0,
    使用强度: a.usageLevel ?? '',
  }));
  const stamp = new Date().toISOString().slice(0, 10);
  download(
    `hmm-assets-${stamp}.csv`,
    toCSV(rows, ['名称', '品类', '房间', '购买日期', '价格元', '质保月', '预计寿命月', '使用强度']),
    'text/csv;charset=utf-8',
  );
}

export interface ImportResult {
  ok: boolean;
  message: string;
  counts?: Record<DataKey, number>;
}

export function importJSON(text: string, mode: 'replace' | 'merge' = 'merge'): ImportResult {
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

  const counts = {} as Record<DataKey, number>;
  for (const [name, key] of Object.entries(STORAGE_KEYS) as Array<[DataKey, string]>) {
    const incoming = (file.data as Record<string, unknown[]>)?.[name];
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

  return { ok: true, message: '导入完成，刷新页面后生效', counts };
}

export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key);
}
