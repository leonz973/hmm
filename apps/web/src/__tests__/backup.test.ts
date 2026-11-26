// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { collectBackup, exportJSON } from '@/lib/backup';
import { useAssetsStore } from '@/stores/assets';
import { useBillsStore } from '@/stores/bills';

// 回归：导出必须读 Pinia store，而不是 localStorage。
// 云模式下 localStorage 是空的，旧实现导出的就是空文件。
describe('备份导出：数据源是 store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    // jsdom 没有 createObjectURL，下载链接只是在测试里被拦截
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('资产与账单都能被导出', async () => {
    const assets = useAssetsStore();
    assets.load();
    assets.clearAll();
    await assets.create({
      name: '测试冰箱',
      categoryKey: 'appliance_large',
      categoryName: '大家电',
      location: '厨房',
      purchaseDate: '2026-01-01',
      priceFen: 399900,
      warrantyMonths: 36,
      expectedLifeMonths: 120,
      usageLevel: 'mid',
    } as never);

    const bills = useBillsStore();
    bills.load();
    bills.clearAll();
    await bills.create({ type: '水费', period: '2026-11', amountFen: 8600, usage: 12, dueDate: '2026-11-30' });

    const backup = collectBackup();
    expect(backup.app).toBe('hmm');
    expect(backup.data.assets.length).toBe(1);
    expect((backup.data.assets[0] as { name: string }).name).toBe('测试冰箱');
    expect(backup.data.bills.length).toBe(1);
  });

  it('localStorage 里有数据但 store 为空时，导出的是 store（当前真实视图）', () => {
    localStorage.setItem('hmm.assets.v1', JSON.stringify([{ id: 'x', name: '幽灵资产' }]));
    const assets = useAssetsStore();
    assets.load();
    assets.clearAll();
    const backup = collectBackup();
    expect(backup.data.assets.length).toBe(0);
  });

  it('exportJSON 不抛错（需要 DOM 下载能力）', () => {
    expect(() => exportJSON()).not.toThrow();
  });
});
