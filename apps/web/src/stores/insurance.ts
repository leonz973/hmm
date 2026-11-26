import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { api, type InsuranceRecord } from '@/lib/api';
import { daysUntil, loadJSON, saveJSON, todayISO, uid } from '@/lib/persist';
import { useAuthStore } from '@/stores/auth';

const STORAGE_KEY = 'hmm.insurance.v1';

export const INSURANCE_KINDS = ['家财险', '车险', '医疗险', '意外险', '寿险', '其他'];

export interface StoredPolicy {
  id: string;
  name: string;
  kind: string;
  company?: string;
  coverageFen: number;
  premiumFen: number;
  cycle: string;
  startDate: string;
  endDate: string;
  contact?: string;
  note?: string;
  createdAt: string;
}

export interface PolicyView extends StoredPolicy {
  daysToEnd: number;
  expired: boolean;
}

export type PolicyInput = Omit<StoredPolicy, 'id' | 'createdAt'>;

export const useInsuranceStore = defineStore('insurance', () => {
  const auth = useAuthStore();
  const items = ref<StoredPolicy[]>([]);
  const loaded = ref(false);
  const syncing = ref(false);

  function load() {
    if (loaded.value) return;
    items.value = loadJSON<StoredPolicy[]>(STORAGE_KEY, []);
    loaded.value = true;
  }

  watch(
    items,
    (value) => {
      if (auth.isCloud) return;
      saveJSON(STORAGE_KEY, value);
    },
    { deep: true },
  );

  const views = computed<PolicyView[]>(() =>
    items.value
      .map((p) => {
        const daysToEnd = daysUntil(p.endDate);
        return { ...p, daysToEnd, expired: daysToEnd < 0 };
      })
      .sort((a, b) => a.daysToEnd - b.daysToEnd),
  );

  const totalCoverageFen = computed(() => views.value.reduce((s, p) => s + p.coverageFen, 0));
  const annualPremiumFen = computed(() =>
    views.value.reduce((s, p) => {
      const times = p.cycle === '每月' ? 12 : p.cycle === '每季' ? 4 : p.cycle === '每半年' ? 2 : 1;
      return s + p.premiumFen * times;
    }, 0),
  );

  function expiring(leadDays: number): PolicyView[] {
    return views.value.filter((p) => p.daysToEnd <= leadDays && p.daysToEnd >= -30);
  }

  async function hydrateFromCloud() {
    if (!auth.isCloud) return;
    syncing.value = true;
    try {
      const rows = await api.listInsurance<InsuranceRecord[]>();
      items.value = rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        company: r.company,
        coverageFen: r.coverageFen,
        premiumFen: r.premiumFen,
        cycle: r.cycle,
        startDate: r.startDate,
        endDate: r.endDate,
        contact: r.contact,
        note: r.note,
        createdAt: r.createdAt,
      }));
      loaded.value = true;
    } finally {
      syncing.value = false;
    }
  }

  async function create(input: PolicyInput) {
    if (auth.isCloud) {
      const r = await api.createInsurance<InsuranceRecord>({ ...input });
      items.value = [...items.value, { ...r } as StoredPolicy];
      return r.id;
    }
    const id = uid();
    items.value = [...items.value, { ...input, id, createdAt: todayISO() }];
    return id;
  }

  async function update(id: string, patch: Partial<PolicyInput>) {
    if (auth.isCloud) {
      const r = await api.updateInsurance<InsuranceRecord>(id, patch);
      items.value = items.value.map((p) => (p.id === id ? ({ ...r } as StoredPolicy) : p));
      return;
    }
    items.value = items.value.map((p) => (p.id === id ? { ...p, ...patch } : p));
  }

  async function remove(id: string) {
    if (auth.isCloud) await api.deleteInsurance(id);
    items.value = items.value.filter((p) => p.id !== id);
  }

  return { items, views, loaded, syncing, totalCoverageFen, annualPremiumFen, expiring, load, hydrateFromCloud, create, update, remove };
});
