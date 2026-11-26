import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { api, type MaintenancePayload, type MaintenanceRecord } from '@/lib/api';
import { addMonths, daysUntil, loadJSON, saveJSON, todayISO, uid } from '@/lib/persist';
import { useAssetsStore } from '@/stores/assets';
import { useAuthStore } from '@/stores/auth';

const STORAGE_KEY = 'hmm.maintenance.v1';

export interface StoredPlan {
  id: string;
  assetId: string;
  title: string;
  intervalMonths: number;
  lastDoneDate: string;
  nextDueDate: string;
  note: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanView extends StoredPlan {
  assetName: string;
  daysLeft: number;
}

export type PlanInput = {
  assetId: string;
  title: string;
  intervalMonths: number;
  lastDoneDate?: string;
  nextDueDate?: string;
  note?: string;
};

export const useMaintenanceStore = defineStore('maintenance', () => {
  const auth = useAuthStore();
  const assets = useAssetsStore();

  const items = ref<StoredPlan[]>([]);
  const loaded = ref(false);
  const syncing = ref(false);

  function load() {
    if (loaded.value) return;
    items.value = loadJSON<StoredPlan[]>(STORAGE_KEY, []);
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

  const views = computed<PlanView[]>(() =>
    items.value.map((p) => ({
      ...p,
      assetName: assets.getById(p.assetId)?.name ?? '已删除的资产',
      daysLeft: daysUntil(p.nextDueDate),
    })),
  );

  function byAsset(assetId: string): PlanView[] {
    return views.value
      .filter((p) => p.assetId === assetId && p.enabled)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  const dueSoon = computed<PlanView[]>(() =>
    views.value.filter((p) => p.enabled && p.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft),
  );

  async function hydrateFromCloud() {
    if (!auth.isCloud) return;
    syncing.value = true;
    try {
      const rows = await api.listMaintenance<MaintenanceRecord>();
      items.value = rows.map((r) => ({
        id: r.id,
        assetId: r.assetId,
        title: r.title,
        intervalMonths: r.intervalMonths,
        lastDoneDate: r.lastDoneDate,
        nextDueDate: r.nextDueDate,
        note: r.note,
        enabled: r.enabled,
        createdAt: String(r.createdAt),
        updatedAt: String(r.updatedAt),
      }));
    } finally {
      syncing.value = false;
      loaded.value = true;
    }
  }

  async function create(input: PlanInput): Promise<string> {
    if (auth.isCloud) {
      const payload: MaintenancePayload = {
        assetId: input.assetId,
        title: input.title,
        intervalMonths: input.intervalMonths,
        lastDoneDate: input.lastDoneDate,
        nextDueDate: input.nextDueDate,
        note: input.note,
      };
      const saved = await api.createMaintenance<MaintenanceRecord>(payload);
      items.value.push({
        id: saved.id,
        assetId: saved.assetId,
        title: saved.title,
        intervalMonths: saved.intervalMonths,
        lastDoneDate: saved.lastDoneDate,
        nextDueDate: saved.nextDueDate,
        note: saved.note,
        enabled: saved.enabled,
        createdAt: String(saved.createdAt),
        updatedAt: String(saved.updatedAt),
      });
      return saved.id;
    }
    const lastDoneDate = input.lastDoneDate ?? todayISO();
    const now = new Date().toISOString();
    const plan: StoredPlan = {
      id: uid(),
      assetId: input.assetId,
      title: input.title,
      intervalMonths: input.intervalMonths,
      lastDoneDate,
      nextDueDate: input.nextDueDate ?? addMonths(lastDoneDate, input.intervalMonths),
      note: input.note ?? '',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    items.value.push(plan);
    return plan.id;
  }

  async function done(id: string, doneDate = todayISO()) {
    if (auth.isCloud) {
      const saved = await api.doneMaintenance<MaintenanceRecord>(id, doneDate);
      const idx = items.value.findIndex((p) => p.id === id);
      if (idx >= 0) {
        items.value[idx] = {
          ...items.value[idx],
          lastDoneDate: saved.lastDoneDate,
          nextDueDate: saved.nextDueDate,
          updatedAt: String(saved.updatedAt),
        };
      }
      return;
    }
    const plan = items.value.find((p) => p.id === id);
    if (!plan) return;
    plan.lastDoneDate = doneDate;
    plan.nextDueDate = addMonths(doneDate, plan.intervalMonths);
    plan.updatedAt = new Date().toISOString();
  }

  async function remove(id: string) {
    if (auth.isCloud) {
      await api.deleteMaintenance(id);
      items.value = items.value.filter((p) => p.id !== id);
      return;
    }
    items.value = items.value.filter((p) => p.id !== id);
  }

  function clearAll() {
    items.value = [];
  }

  return { items, loaded, syncing, load, views, byAsset, dueSoon, hydrateFromCloud, create, done, remove, clearAll };
});
