import { describe, expect, it } from 'vitest';
import { daysBetween, localDateStr, severityOf } from './reminders.service';

/**
 * 这几条都对应真实踩过的坑：
 * - runDate 曾用 toISOString().slice(0,10) 在东八区退了一天
 * - 严重度分档决定了邮件里哪些条目会被标红
 */
describe('提醒引擎的日期与分档', () => {
  it('本地日期不会因为 UTC 换算退一天', () => {
    // 东八区 2026-11-25 00:30，UTC 还停在 11-24
    const d = new Date(2026, 10, 25, 0, 30);
    expect(localDateStr(d)).toBe('2026-11-25');
  });

  it('补零到两位', () => {
    expect(localDateStr(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  it('把日期字符串换算成剩余天数', () => {
    const from = new Date(2026, 10, 25);
    expect(daysBetween(from, '2026-11-25')).toBe(0);
    expect(daysBetween(from, '2026-12-05')).toBe(10);
    expect(daysBetween(from, '2026-11-20')).toBe(-5);
  });

  it('14 天内算紧急、45 天内算注意、更远是普通', () => {
    expect(severityOf(-3)).toBe('urgent');
    expect(severityOf(0)).toBe('urgent');
    expect(severityOf(14)).toBe('urgent');
    expect(severityOf(15)).toBe('warn');
    expect(severityOf(45)).toBe('warn');
    expect(severityOf(46)).toBe('info');
    expect(severityOf(365)).toBe('info');
  });
});
