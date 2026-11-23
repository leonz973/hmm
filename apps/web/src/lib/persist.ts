/**
 * 本地持久化小工具：统一 localStorage 读写、ID 生成、日期格式化。
 * 后续接后端时，只需把这些 store 的实现换成 API 调用，页面不用动。
 */

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // 配额满或隐私模式：静默失败，内存里的数据仍可用
    return false;
  }
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysUntil(dateISO: string): number {
  const target = new Date(dateISO + 'T00:00:00').getTime();
  const now = new Date(todayISO() + 'T00:00:00').getTime();
  return Math.round((target - now) / 86400000);
}

/** 在 dateISO 基础上加 n 个月，保留日（月末溢出由 Date 顺延） */
export function addMonths(dateISO: string, n: number): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function money(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
