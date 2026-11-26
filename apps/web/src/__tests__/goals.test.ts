// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSavingGoalsStore } from '@/stores/savingGoals';
import { useInsuranceStore } from '@/stores/insurance';

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe('储蓄目标', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('算出进度、还差多少、每月要存多少', async () => {
    const s = useSavingGoalsStore();
    s.load();
    await s.create({ name: '换车首付', targetFen: 8_000_000, savedFen: 2_000_000, targetDate: iso(365) });
    const v = s.views[0];
    expect(v.percent).toBe(25);
    expect(v.remainingFen).toBe(6_000_000);
    expect(v.monthsLeft).toBeGreaterThan(11);
    expect(v.monthlyNeedFen).toBe(Math.ceil(6_000_000 / v.monthsLeft));
    expect(s.totalTargetFen).toBe(8_000_000);
    expect(s.totalSavedFen).toBe(2_000_000);
  });

  it('存一笔之后余额和进度都更新', async () => {
    const s = useSavingGoalsStore();
    s.load();
    const id = await s.create({ name: '旅行', targetFen: 1_000_000, savedFen: 0, targetDate: iso(180) });
    await s.deposit(id, 250_000);
    expect(s.views[0].savedFen).toBe(250_000);
    expect(s.views[0].percent).toBe(25);
    await s.deposit(id, -100_000);
    expect(s.views[0].savedFen).toBe(150_000);
  });
});

describe('保险台账', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('到期筛选与年保费折算（每月 → ×12）', async () => {
    const ins = useInsuranceStore();
    ins.load();
    await ins.create({
      name: '家财险',
      kind: '家财险',
      coverageFen: 100_000_000,
      premiumFen: 6_800,
      cycle: '每月',
      startDate: iso(-30),
      endDate: iso(20),
    });
    expect(ins.annualPremiumFen).toBe(6_800 * 12);
    expect(ins.expiring(30)).toHaveLength(1);
    expect(ins.expiring(5)).toHaveLength(0);
    expect(ins.views[0].daysToEnd).toBe(20);
  });

  it('过期保单标 expired', async () => {
    const ins = useInsuranceStore();
    ins.load();
    await ins.create({
      name: '旧车险',
      kind: '车险',
      coverageFen: 0,
      premiumFen: 0,
      cycle: '每年',
      startDate: iso(-400),
      endDate: iso(-10),
    });
    expect(ins.views[0].expired).toBe(true);
  });
});
