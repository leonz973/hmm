import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFixedExpensesStore } from '@/stores/fixedExpenses';
import { useBillsStore } from '@/stores/bills';

// 只测纯计算逻辑：localStorage 在 jsdom 未启用时会被 persist 静默吞掉
describe('固定支出：周期折算与现金流', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('月/季/年 都能折算到月度与年度', () => {
    const store = useFixedExpensesStore();
    store.load();
    store.clearAll();

    store.create({ name: '房租', amountFen: 450000, cycle: '每月', dueDate: '2026-01-01', category: '居住', autoPay: true });
    store.create({ name: '保洁', amountFen: 36000, cycle: '每季', dueDate: '2026-01-10', category: '居住', autoPay: false });
    store.create({ name: '车险', amountFen: 480000, cycle: '每年', dueDate: '2026-03-20', category: '保险', autoPay: false });

    // 4500 + 360/3=120 + 4800/12=400 → 5020 元/月 = 502000 分
    expect(store.monthlyTotalFen).toBe(502000);
    expect(store.annualTotalFen).toBe(6024000);
  });

  it('未来 12 个月只在该扣的月份计入金额', () => {
    const store = useFixedExpensesStore();
    store.load();
    store.clearAll();
    store.create({ name: '年付保险', amountFen: 480000, cycle: '每年', dueDate: '2026-03-20', category: '保险', autoPay: false });

    const months = store.next12Months;
    expect(months).toHaveLength(12);
    const total = months.reduce((s, m) => s + m.amountFen, 0);
    // 一年只付一次
    expect(total).toBe(480000);
  });
});

describe('账单：环比与未缴金额', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('环比按账期相邻月份计算', () => {
    const store = useBillsStore();
    store.load();
    store.clearAll();
    store.create({ type: '电费', period: '2026-10', amountFen: 20000, dueDate: '2026-10-25' });
    store.create({ type: '电费', period: '2026-11', amountFen: 25000, dueDate: '2026-11-25' });

    expect(store.monthOverMonth('2026-11')).toBe(25);
    expect(store.monthOverMonth('2026-10')).toBeNull();
  });

  it('未缴合计只算没标记已缴的', async () => {
    const store = useBillsStore();
    store.load();
    store.clearAll();
    const a = await store.create({ type: '水费', period: '2026-11', amountFen: 8000, dueDate: '2026-11-25' });
    await store.create({ type: '燃气费', period: '2026-11', amountFen: 12000, dueDate: '2026-11-25' });

    expect(store.unpaidFen).toBe(20000);
    store.markPaid(a, '2026-11-20');
    expect(store.unpaidFen).toBe(12000);
  });
});
