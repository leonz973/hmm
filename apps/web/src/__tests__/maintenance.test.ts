// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { addMonths } from '@/lib/persist';
import { useMaintenanceStore } from '@/stores/maintenance';

describe('日期：月末加月不溢出', () => {
  it('1-31 加 1 个月落到 2-28/29', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('跨年也正确', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('保养计划：本地模式的新增与完成', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('按上次完成日 + 周期算下次到期；完成后按完成日顺延', async () => {
    const store = useMaintenanceStore();
    store.load();
    store.clearAll();

    const id = await store.create({
      assetId: 'asset-1',
      title: '换滤芯',
      intervalMonths: 3,
      lastDoneDate: '2026-08-01',
    });
    expect(store.items.length).toBe(1);
    expect(store.items[0].nextDueDate).toBe('2026-11-01');

    await store.done(id, '2026-11-26');
    expect(store.items[0].lastDoneDate).toBe('2026-11-26');
    expect(store.items[0].nextDueDate).toBe('2027-02-26');
  });

  it('byAsset 只返回这件资产的计划，并按到期日排序', async () => {
    const store = useMaintenanceStore();
    store.load();
    store.clearAll();
    await store.create({ assetId: 'a1', title: '清洗滤网', intervalMonths: 6, lastDoneDate: '2026-11-01' });
    await store.create({ assetId: 'a1', title: '换滤芯', intervalMonths: 1, lastDoneDate: '2026-11-01' });
    await store.create({ assetId: 'a2', title: '检修', intervalMonths: 12, lastDoneDate: '2026-11-01' });

    const list = store.byAsset('a1');
    expect(list.length).toBe(2);
    expect(list[0].title).toBe('换滤芯');
    expect(list[1].title).toBe('清洗滤网');
  });
});
