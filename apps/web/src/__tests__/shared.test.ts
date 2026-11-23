import { describe, expect, it } from 'vitest';
import {
  calcReplacementDate,
  calcWarrantyEndDate,
  formatFen,
  parseYuanToFen,
  toISODate,
} from '@hmm/shared';

describe('日期换算（本地时区，不得因 UTC 换算退一天）', () => {
  it('质保到期日 = 购买日 + N 月，且日期不偏移', () => {
    expect(calcWarrantyEndDate('2019-05-18', 36)).toBe('2022-05-18');
    expect(calcWarrantyEndDate('2026-09-01', 12)).toBe('2027-09-01');
    expect(calcWarrantyEndDate('2026-09-01', 0)).toBe('2026-09-01');
  });

  it('预计更换日按使用强度折算寿命', () => {
    expect(calcReplacementDate('2019-05-18', 156, 'mid')).toBe('2032-05-18');
    // 156 × 0.8 = 124.8 → 125 个月
    expect(calcReplacementDate('2019-05-18', 156, 'high')).toBe('2029-10-18');
    // 156 × 1.2 = 187.2 → 187 个月 → 2034 年 12 月
    expect(calcReplacementDate('2019-05-18', 156, 'low')).toBe('2034-12-18');
  });

  it('跨月末的月份推进由 Date.setMonth 处理', () => {
    expect(calcWarrantyEndDate('2026-01-31', 1)).toBe('2026-03-03');
  });

  it('toISODate 用本地字段拼接', () => {
    expect(toISODate(new Date(2026, 10, 23))).toBe('2026-11-23');
  });
});

describe('金额换算（一律以分存储）', () => {
  it('元 → 分', () => {
    expect(parseYuanToFen('4299')).toBe(429900);
    expect(parseYuanToFen('4,299.5')).toBe(429950);
    expect(parseYuanToFen(' 189.00 ')).toBe(18900);
    expect(parseYuanToFen(0)).toBe(0);
  });

  it('非法输入返回 null', () => {
    expect(parseYuanToFen('abc')).toBeNull();
    expect(parseYuanToFen('-1')).toBeNull();
    expect(parseYuanToFen('')).toBeNull();
  });

  it('分 → "1,234.56"', () => {
    expect(formatFen(429900)).toBe('4,299.00');
    expect(formatFen(123456)).toBe('1,234.56');
    expect(formatFen(0)).toBe('0.00');
  });
});
