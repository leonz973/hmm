import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { currentMonth, loadJSON, saveJSON, todayISO, uid } from '@/lib/persist';

export const BILL_TYPES = ['水费', '电费', '燃气费', '物业费', '其他'] as const;
export type BillType = (typeof BILL_TYPES)[number];

export interface Bill {
  id: string;
  type: BillType;
  /** 账期 YYYY-MM */
  period: string;
  amountFen: number;
  /** 用量（可选）：吨 / 度 / 立方 */
  usage?: number;
  dueDate: string;
  paidDate?: string;
  note?: string;
  createdAt: string;
}

const STORAGE_KEY = 'hmm.bills.v1';

const UNIT: Record<BillType, string> = {
  水费: '吨',
  电费: '度',
  燃气费: '立方',
  物业费: '月',
  其他: '项',
};

function seed(): Bill[] {
  const now = new Date().toISOString();
  const mk = (
    type: BillType,
    period: string,
    amountFen: number,
    usage: number,
    dueDay: number,
    paid: boolean,
  ): Bill => {
    const [y, m] = period.split('-').map(Number);
    const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    return {
      id: uid(),
      type,
      period,
      amountFen,
      usage,
      dueDate,
      paidDate: paid ? dueDate.slice(0, 8) + String(Math.min(dueDay + 1, 28)).padStart(2, '0') : undefined,
      createdAt: now,
    };
  };

  return [
    mk('电费', '2026-09', 21860, 312, 25, true),
    mk('水费', '2026-09', 7240, 18.1, 25, true),
    mk('燃气费', '2026-09', 9860, 41.2, 25, true),
    mk('电费', '2026-10', 24780, 354, 25, true),
    mk('水费', '2026-10', 6880, 17.2, 25, true),
    mk('燃气费', '2026-10', 11200, 46.8, 25, true),
    mk('电费', '2026-11', 23860, 341, 25, false),
    mk('水费', '2026-11', 8640, 21.6, 25, false),
    mk('燃气费', '2026-11', 11200, 46.8, 25, false),
  ];
}

export interface BillView extends Bill {
  unit: string;
  isPaid: boolean;
  overdue: boolean;
}

export const useBillsStore = defineStore('bills', () => {
  const items = ref<Bill[]>([]);
  const loaded = ref(false);

  function load() {
    if (loaded.value) return;
    loaded.value = true;
    const stored = loadJSON<Bill[] | null>(STORAGE_KEY, null);
    items.value = Array.isArray(stored) ? stored : seed();
  }

  watch(
    items,
    (v) => {
      if (loaded.value) saveJSON(STORAGE_KEY, v);
    },
    { deep: true },
  );

  const views = computed<BillView[]>(() =>
    items.value
      .map((b) => ({
        ...b,
        unit: UNIT[b.type],
        isPaid: Boolean(b.paidDate),
        overdue: !b.paidDate && new Date(b.dueDate + 'T23:59:59').getTime() < Date.now(),
      }))
      .sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : a.type.localeCompare(b.type))),
  );

  const byPeriod = computed<Record<string, BillView[]>>(() => {
    const out: Record<string, BillView[]> = {};
    for (const v of views.value) (out[v.period] ||= []).push(v);
    return out;
  });

  const months = computed(() => Object.keys(byPeriod.value).sort().reverse());

  const thisMonth = computed(() => byPeriod.value[currentMonth()] ?? []);

  const unpaidFen = computed(() => views.value.filter((v) => !v.isPaid).reduce((s, v) => s + v.amountFen, 0));

  const yearTotalFen = computed(() => {
    const y = String(new Date().getFullYear());
    return views.value.filter((v) => v.period.startsWith(y)).reduce((s, v) => s + v.amountFen, 0);
  });

  /** 最近 12 个账期的总支出，用于趋势图 */
  const trend = computed(() => {
    const rows = months.value.slice(0, 12).reverse();
    return rows.map((m) => ({
      period: m,
      amountFen: byPeriod.value[m].reduce((s, b) => s + b.amountFen, 0),
    }));
  });

  /** 本月比上月涨跌多少（%），无上月数据返回 null */
  function monthOverMonth(period: string): number | null {
    const idx = months.value.indexOf(period);
    if (idx < 0 || idx + 1 >= months.value.length) return null;
    const cur = byPeriod.value[period].reduce((s, b) => s + b.amountFen, 0);
    const prev = byPeriod.value[months.value[idx + 1]].reduce((s, b) => s + b.amountFen, 0);
    if (!prev) return null;
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  }

  function create(input: Omit<Bill, 'id' | 'createdAt'>): string {
    const id = uid();
    items.value.push({ ...input, id, createdAt: new Date().toISOString() });
    return id;
  }

  function markPaid(id: string, date = todayISO()) {
    const b = items.value.find((x) => x.id === id);
    if (b) b.paidDate = date;
  }

  function markUnpaid(id: string) {
    const b = items.value.find((x) => x.id === id);
    if (b) b.paidDate = undefined;
  }

  function remove(id: string) {
    items.value = items.value.filter((b) => b.id !== id);
  }

  function restoreDemo() {
    items.value = seed();
  }

  function clearAll() {
    items.value = [];
  }

  return {
    items,
    loaded,
    views,
    byPeriod,
    months,
    thisMonth,
    unpaidFen,
    yearTotalFen,
    trend,
    monthOverMonth,
    load,
    create,
    markPaid,
    markUnpaid,
    remove,
    restoreDemo,
    clearAll,
  };
});

export { UNIT as BILL_UNIT };
