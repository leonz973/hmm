import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { api, type AssetPayload } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  BUILTIN_CATEGORIES,
  calcReplacementDate,
  calcWarrantyEndDate,
  USAGE_LIFE_FACTOR,
  type UsageLevel,
} from '@hmm/shared';

export interface StoredAsset {
  id: string;
  name: string;
  categoryKey: string;
  categoryName: string;
  location: string;
  purchaseDate: string;
  /** 金额一律存「分」 */
  priceFen: number;
  warrantyMonths: number;
  expectedLifeMonths: number;
  usageLevel: UsageLevel;
  notes?: string;
  /** in_use | replaced | scrapped…（本地模式只用到前两个） */
  status?: 'in_use' | 'replaced' | 'scrapped' | 'donated' | 'sold';
  replacedByAssetId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetView extends StoredAsset {
  warrantyEndDate: string;
  expectedReplaceDate: string;
  daysToReplace: number;
  lifeUsedPercent: number;
  residualValueFen: number;
  estimatedReplaceCostFen: number;
  warrantyExpired: boolean;
}

const STORAGE_KEY = 'hmm.assets.v1';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000);
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** 首次使用时的示例数据，用户可以改、删，也可一键清空 */
function seedAssets(): StoredAsset[] {
  const make = (
    name: string,
    categoryKey: string,
    location: string,
    purchaseDate: string,
    priceFen: number,
    usageLevel: UsageLevel,
    warrantyMonths?: number,
    expectedLifeMonths?: number,
  ): StoredAsset => {
    const cat = BUILTIN_CATEGORIES.find((c) => c.key === categoryKey);
    return {
      id: crypto.randomUUID(),
      name,
      categoryKey,
      categoryName: cat?.name ?? categoryKey,
      location,
      purchaseDate,
      priceFen,
      warrantyMonths: warrantyMonths ?? cat?.warrantyMonths ?? 12,
      expectedLifeMonths: expectedLifeMonths ?? cat?.lifeMonths ?? 96,
      usageLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  return [
    make('海尔冰箱 BCD-501', 'fridge', '厨房', '2019-05-18', 429900, 'mid'),
    make('小米空调 1.5匹', 'ac', '主卧', '2021-06-02', 269900, 'high'),
    make('林内燃气热水器', 'gas_heater', '卫生间', '2018-03-11', 318000, 'mid'),
    make('西门子洗衣机', 'washer', '阳台', '2020-09-25', 389900, 'mid'),
    make('实木餐桌', 'dining_table', '餐厅', '2021-11-08', 560000, 'mid'),
    make('净水滤芯（RO）', 'purifier_filter', '厨房', '2026-09-01', 18900, 'mid'),
  ];
}

export const useAssetsStore = defineStore('assets', () => {
  const items = ref<StoredAsset[]>([]);
  const loaded = ref(false);
  const auth = useAuthStore();
  const syncing = ref(false);
  const syncError = ref('');

  /** 云模式：从服务器拉一份覆盖本地缓存 */
  async function hydrateFromCloud() {
    syncing.value = true;
    syncError.value = '';
    try {
      const rows = await api.listAssets<StoredAsset>();
      items.value = rows;
    } catch (e) {
      syncError.value = e instanceof Error ? e.message : '同步失败';
    } finally {
      syncing.value = false;
    }
  }

  function load() {
    if (loaded.value) return;
    loaded.value = true;

    if (auth.isCloud) {
      // 登录状态下不要塞示例数据：否则换台设备会先看到假的资产
      void hydrateFromCloud();
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items.value = parsed;
          return;
        }
      }
    } catch {
      // 数据损坏时回到种子数据，避免整个应用起不来
    }
    items.value = seedAssets();
  }

  watch(
    items,
    (value) => {
      if (!loaded.value) return;
      // 云模式下列表是服务器的真相，不写本地缓存：否则退出登录后还能看到别人家的数据
      if (auth.isCloud) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // 存储配额满时静默失败：数据仍在内存里，本页可用
      }
    },
    { deep: true },
  );

  const views = computed<AssetView[]>(() => {
    const today = todayISO();
    return items.value.map((a) => {
      const warrantyEndDate = calcWarrantyEndDate(a.purchaseDate, a.warrantyMonths);
      const expectedReplaceDate = calcReplacementDate(a.purchaseDate, a.expectedLifeMonths, a.usageLevel);
      const totalMonths = Math.max(1, monthsBetween(a.purchaseDate, expectedReplaceDate));
      const usedMonths = monthsBetween(a.purchaseDate, today);
      const lifeUsedPercent = Math.min(100, Math.max(0, Math.round((usedMonths / totalMonths) * 100)));
      const residualValueFen = Math.max(0, Math.round(a.priceFen * (1 - lifeUsedPercent / 100)));
      const cat = BUILTIN_CATEGORIES.find((c) => c.key === a.categoryKey);
      const years = Math.max(0, totalMonths / 12);
      const estimatedReplaceCostFen = Math.round(a.priceFen * Math.pow(1 + (cat?.inflationRate ?? 0) / 100, years));
      return {
        ...a,
        warrantyEndDate,
        expectedReplaceDate,
        daysToReplace: daysBetween(today, expectedReplaceDate),
        lifeUsedPercent,
        residualValueFen,
        estimatedReplaceCostFen,
        warrantyExpired: a.warrantyMonths > 0 && daysBetween(today, warrantyEndDate) < 0,
      };
    });
  });

  /** 最该换的排前面；已超期的负数排最前 */
  const sortedViews = computed(() => [...views.value].sort((a, b) => a.daysToReplace - b.daysToReplace));

  /** 提醒、金额预估、现金流只算还在用的：已换新的旧件不再占预算 */
  const activeViews = computed(() => views.value.filter((a) => (a.status ?? 'in_use') === 'in_use'));

  const totalValueFen = computed(() =>
    items.value.filter((a) => (a.status ?? 'in_use') === 'in_use').reduce((s, a) => s + a.priceFen, 0),
  );
  const totalResidualFen = computed(() =>
    activeViews.value.reduce((s, a) => s + a.residualValueFen, 0),
  );

  function getById(id: string): StoredAsset | undefined {
    return items.value.find((a) => a.id === id);
  }

  function toPayload(input: Partial<StoredAsset>): AssetPayload {
    return {
      name: input.name ?? '',
      categoryKey: input.categoryKey,
      categoryName: input.categoryName,
      location: input.location,
      purchaseDate: input.purchaseDate,
      priceFen: input.priceFen,
      warrantyMonths: input.warrantyMonths,
      expectedLifeMonths: input.expectedLifeMonths,
      usageLevel: input.usageLevel,
      note: input.notes,
    };
  }

  async function create(input: Omit<StoredAsset, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (auth.isCloud) {
      const saved = await api.createAsset<StoredAsset>(toPayload(input));
      items.value = [saved, ...items.value];
      return saved.id;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    items.value.push({ ...input, id, createdAt: now, updatedAt: now });
    return id;
  }

  async function update(id: string, patch: Partial<StoredAsset>) {
    if (auth.isCloud) {
      const saved = await api.updateAsset<StoredAsset>(id, toPayload(patch));
      const idx = items.value.findIndex((a) => a.id === id);
      if (idx >= 0) items.value[idx] = saved;
      return;
    }
    const idx = items.value.findIndex((a) => a.id === id);
    if (idx < 0) return;
    items.value[idx] = { ...items.value[idx], ...patch, id, updatedAt: new Date().toISOString() };
  }

  /** 以旧换新：旧件标记 replaced，新件进列表 */
  async function replace(
    id: string,
    payload: {
      purchaseDate: string;
      priceFen: number;
      name?: string;
      warrantyMonths?: number;
      expectedLifeMonths?: number;
      usageLevel?: UsageLevel;
    },
  ): Promise<string> {
    if (auth.isCloud) {
      const res = await api.replaceAsset<{ old: StoredAsset; new: StoredAsset }>(id, payload);
      const idx = items.value.findIndex((a) => a.id === id);
      if (idx >= 0) items.value[idx] = res.old;
      items.value = [res.new, ...items.value];
      return res.new.id;
    }
    const old = items.value.find((a) => a.id === id);
    if (!old) throw new Error('资产不存在');
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    items.value.push({
      ...old,
      ...payload,
      name: payload.name?.trim() || old.name,
      id: newId,
      status: 'in_use',
      replacedByAssetId: null,
      createdAt: now,
      updatedAt: now,
    });
    old.status = 'replaced';
    old.replacedByAssetId = newId;
    old.updatedAt = now;
    return newId;
  }

  async function remove(id: string) {
    if (auth.isCloud) await api.deleteAsset(id);
    items.value = items.value.filter((a) => a.id !== id);
  }

  function clearAll() {
    items.value = [];
  }

  function restoreDemo() {
    items.value = seedAssets();
  }

  /** 寿命系数提示：高使用强度按 0.8 折算 */
  function effectiveLifeMonths(baseMonths: number, usage: UsageLevel): number {
    return Math.round(baseMonths * USAGE_LIFE_FACTOR[usage]);
  }

  return {
    items,
    loaded,
    syncing,
    syncError,
    hydrateFromCloud,
    views,
    activeViews,
    sortedViews,
    totalValueFen,
    totalResidualFen,
    load,
    getById,
    create,
    update,
    replace,
    remove,
    clearAll,
    restoreDemo,
    effectiveLifeMonths,
  };
});
