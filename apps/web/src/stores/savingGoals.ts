import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { api, type SavingGoalRecord } from '@/lib/api';
import { daysUntil, loadJSON, saveJSON, todayISO, uid } from '@/lib/persist';
import { useAuthStore } from '@/stores/auth';

const STORAGE_KEY = 'hmm.savingGoals.v1';

export interface StoredGoal {
  id: string;
  name: string;
  targetFen: number;
  savedFen: number;
  targetDate: string;
  linkedAssetId?: string;
  note?: string;
  createdAt: string;
}

export interface GoalView extends StoredGoal {
  percent: number;
  remainingFen: number;
  daysLeft: number;
  monthsLeft: number;
  monthlyNeedFen: number;
  done: boolean;
}

export type GoalInput = Omit<StoredGoal, 'id' | 'createdAt'>;

export const useSavingGoalsStore = defineStore('savingGoals', () => {
  const auth = useAuthStore();
  const items = ref<StoredGoal[]>([]);
  const loaded = ref(false);
  const syncing = ref(false);
  const syncError = ref('');

  function load() {
    if (loaded.value) return;
    items.value = loadJSON<StoredGoal[]>(STORAGE_KEY, []);
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

  const views = computed<GoalView[]>(() =>
    items.value.map((g) => {
      const remainingFen = Math.max(0, g.targetFen - g.savedFen);
      const percent = g.targetFen > 0 ? Math.min(100, Math.round((g.savedFen / g.targetFen) * 100)) : 0;
      const daysLeft = daysUntil(g.targetDate);
      const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
      return {
        ...g,
        remainingFen,
        percent,
        daysLeft,
        monthsLeft,
        monthlyNeedFen: remainingFen > 0 ? Math.ceil(remainingFen / monthsLeft) : 0,
        done: remainingFen === 0,
      };
    }),
  );

  const totalTargetFen = computed(() => views.value.reduce((s, g) => s + g.targetFen, 0));
  const totalSavedFen = computed(() => views.value.reduce((s, g) => s + g.savedFen, 0));
  const monthlyNeedFen = computed(() =>
    views.value.filter((g) => !g.done && g.daysLeft >= 0).reduce((s, g) => s + g.monthlyNeedFen, 0),
  );

  async function hydrateFromCloud() {
    if (!auth.isCloud) return;
    syncing.value = true;
    syncError.value = '';
    try {
      const rows = await api.listSavingGoals<SavingGoalRecord[]>();
      items.value = rows.map((r) => ({
        id: r.id,
        name: r.name,
        targetFen: r.targetFen,
        savedFen: r.savedFen,
        targetDate: r.targetDate,
        linkedAssetId: r.linkedAssetId,
        note: r.note,
        createdAt: r.createdAt,
      }));
      loaded.value = true;
    } catch (e) {
      syncError.value = e instanceof Error ? e.message : '同步失败';
    } finally {
      syncing.value = false;
    }
  }

  async function create(input: GoalInput) {
    if (auth.isCloud) {
      const r = await api.createSavingGoal<SavingGoalRecord>({
        name: input.name,
        targetFen: input.targetFen,
        savedFen: input.savedFen,
        targetDate: input.targetDate,
        linkedAssetId: input.linkedAssetId,
        note: input.note,
      });
      items.value = [
        ...items.value,
        { ...r, linkedAssetId: r.linkedAssetId, note: r.note } as StoredGoal,
      ];
      return r.id;
    }
    const id = uid();
    items.value = [...items.value, { ...input, id, createdAt: todayISO() }];
    return id;
  }

  async function update(id: string, patch: Partial<GoalInput>) {
    if (auth.isCloud) {
      const r = await api.updateSavingGoal<SavingGoalRecord>(id, patch);
      items.value = items.value.map((g) => (g.id === id ? ({ ...r } as StoredGoal) : g));
      return;
    }
    items.value = items.value.map((g) => (g.id === id ? { ...g, ...patch } : g));
  }

  async function deposit(id: string, amountFen: number) {
    const g = items.value.find((x) => x.id === id);
    if (!g) return;
    await update(id, { savedFen: Math.max(0, g.savedFen + amountFen) });
  }

  async function remove(id: string) {
    if (auth.isCloud) {
      await api.deleteSavingGoal(id);
    }
    items.value = items.value.filter((g) => g.id !== id);
  }

  function restoreDemo() {
    const created = todayISO();
    items.value = [
      { id: uid(), name: '换车首付', targetFen: 8000000, savedFen: 2500000, targetDate: '2027-06-01', createdAt: created },
      { id: uid(), name: '明年欧洲旅行', targetFen: 4000000, savedFen: 600000, targetDate: '2027-08-01', createdAt: created },
    ];
  }

  return {
    items,
    views,
    loaded,
    syncing,
    syncError,
    totalTargetFen,
    totalSavedFen,
    monthlyNeedFen,
    load,
    hydrateFromCloud,
    create,
    update,
    deposit,
    remove,
    restoreDemo,
  };
});
