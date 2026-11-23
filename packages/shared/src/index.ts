// HMM 共享枚举与类型（前后端单一事实来源）
// 金额一律以"分"为整数存储与计算，展示层再格式化，避免浮点误差。

export const ASSET_STATUS = ['in_use', 'replaced', 'scrapped', 'donated', 'sold'] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

export const USAGE_LEVEL = ['low', 'mid', 'high'] as const;
export type UsageLevel = (typeof USAGE_LEVEL)[number];
/** 使用频率对寿命的修正系数（PRD FR-3.2） */
export const USAGE_LIFE_FACTOR: Record<UsageLevel, number> = { low: 1.2, mid: 1.0, high: 0.8 };

export const WARRANTY_TYPE = ['manufacturer', 'extended', 'seller'] as const;
export type WarrantyType = (typeof WARRANTY_TYPE)[number];
export const WARRANTY_TYPE_LABEL: Record<WarrantyType, string> = {
  manufacturer: '厂家保修',
  extended: '延保',
  seller: '商家保修',
};

export const EXPENSE_CYCLE = ['month', 'quarter', 'half_year', 'year', 'custom_days'] as const;
export type ExpenseCycle = (typeof EXPENSE_CYCLE)[number];

export const UTILITY_TYPE = ['water', 'electricity', 'gas', 'property'] as const;
export type UtilityType = (typeof UTILITY_TYPE)[number];
export const UTILITY_TYPE_LABEL: Record<UtilityType, string> = {
  water: '水费',
  electricity: '电费',
  gas: '燃气费',
  property: '物业费',
};

export const REMINDER_TYPE = [
  'warranty_expire',
  'replacement',
  'fixed_due',
  'subscription',
] as const;
export type ReminderType = (typeof REMINDER_TYPE)[number];
export const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  warranty_expire: '质保到期',
  replacement: '预计更换',
  fixed_due: '固定支出扣款',
  subscription: '订阅续费',
};

export const MEMBER_ROLE = ['owner', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

/** 每日费用上限（防误输入），单位：分 */
export const MAX_AMOUNT_FEN = 99_999_999_00;

/** 格式化分 → "1,234.56" */
export function formatFen(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 解析用户输入金额（元）→ 分；非法返回 null */
export function parseYuanToFen(input: string | number): number | null {
  if (typeof input === 'string' && input.trim() === '') return null;
  const n = typeof input === 'string' ? Number(input.replace(/[,，\s]/g, '')) : input;
  if (!Number.isFinite(n) || n < 0) return null;
  const fen = Math.round(n * 100);
  return fen > MAX_AMOUNT_FEN ? null : fen;
}

/**
 * 推算预计更换日期：购买日期 + 修正寿命
 * @param purchaseDate 购买日期 (YYYY-MM-DD)
 * @param lifeMonths 品类默认寿命（月）
 * @param usageLevel 使用频率修正
 */
export function calcReplacementDate(
  purchaseDate: string,
  lifeMonths: number,
  usageLevel: UsageLevel = 'mid',
): string {
  const d = new Date(purchaseDate + 'T00:00:00');
  d.setMonth(d.getMonth() + Math.round(lifeMonths * USAGE_LIFE_FACTOR[usageLevel]));
  return toISODate(d);
}

/** 推算质保到期日：起始日 + N 个月（默认购买日起算） */
export function calcWarrantyEndDate(startDate: string, warrantyMonths: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setMonth(d.getMonth() + warrantyMonths);
  return toISODate(d);
}

/**
 * 本地时区的 YYYY-MM-DD。
 * 注意：不能用 toISOString()——本地零点序列化到 UTC 会退回前一天（东八区必现 -1 天）。
 */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
