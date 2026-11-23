import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { addMonths, daysUntil, loadJSON, saveJSON, todayISO, uid } from '@/lib/persist';

export type ExpenseCycle = '每月' | '每季' | '每半年' | '每年';

export interface FixedExpense {
  id: string;
  name: string;
  amountFen: number;
  cycle: ExpenseCycle;
  /** 首次/下一次扣款日（YYYY-MM-DD） */
  dueDate: string;
  category: '居住' | '交通' | '保险' | '通讯' | '订阅' | '教育' | '其他';
  autoPay: boolean;
  note?: string;
  createdAt: string;
}

export interface FixedExpenseView extends FixedExpense {
  /** 折算到每月 */
  monthlyFen: number;
  annualFen: number;
  nextDueDate: string;
  daysToDue: number;
  /** 本月是否已扣 */
  paidThisMonth: boolean;
}

const STORAGE_KEY = 'hmm.fixedExpenses.v1';

const CYCLE_MONTHS: Record<ExpenseCycle, number> = {
  每月: 1,
  每季: 3,
  每半年: 6,
  每年: 12,
};

function seed(): FixedExpense[] {
  const now = new Date().toISOString();
  const mk = (
    name: string,
    amountFen: number,
    cycle: ExpenseCycle,
    dueDate: string,
    category: FixedExpense['category'],
    autoPay: boolean,
  ): FixedExpense => ({
    id: uid(),
    name,
    amountFen,
    cycle,
    dueDate,
    category,
    autoPay,
    createdAt: now,
  });

  const y = new Date().getFullYear();
  return [
    mk('房租', 450000, '每月', `${y}-01-01`, '居住', true),
    mk('物业费', 32000, '每月', `${y}-01-05`, '居住', false),
    mk('宽带', 12900, '每月', `${y}-01-10`, '通讯', true),
    mk('手机套餐', 9900, '每月', `${y}-01-15`, '通讯', true),
    mk('视频会员', 2500, '每月', `${y}-01-18`, '订阅', true),
    mk('车险', 468000, '每年', `${y}-03-20`, '保险', false),
    mk('重疾险', 1280000, '每年', `${y}-07-08`, '保险', false),
  ];
}

/** 从 dueDate 起按周期向后滚，找到第一个「不早于今天」的日期 */
function rollForward(dueDate: string, cycle: ExpenseCycle): string {
  const step = CYCLE_MONTHS[cycle];
  let d = dueDate;
  let guard = 0;
  while (daysUntil(d) < 0 && guard < 600) {
    d = addMonths(d, step);
    guard++;
  }
  return d;
}

export const useFixedExpensesStore = defineStore('fixedExpenses', () => {
  const items = ref<FixedExpense[]>([]);
  const loaded = ref(false);

  function load() {
    if (loaded.value) return;
    loaded.value = true;
    const stored = loadJSON<FixedExpense[] | null>(STORAGE_KEY, null);
    items.value = Array.isArray(stored) ? stored : seed();
  }

  watch(
    items,
    (v) => {
      if (loaded.value) saveJSON(STORAGE_KEY, v);
    },
    { deep: true },
  );

  const views = computed<FixedExpenseView[]>(() =>
    items.value.map((f) => {
      const months = CYCLE_MONTHS[f.cycle];
      const nextDueDate = rollForward(f.dueDate, f.cycle);
      const daysToDue = daysUntil(nextDueDate);
      return {
        ...f,
        monthlyFen: Math.round(f.amountFen / months),
        annualFen: Math.round((f.amountFen / months) * 12),
        nextDueDate,
        daysToDue,
        paidThisMonth: daysToDue > 0 && daysToDue > 31 - new Date().getDate(),
      };
    }),
  );

  const monthlyTotalFen = computed(() => views.value.reduce((s, f) => s + f.monthlyFen, 0));
  const annualTotalFen = computed(() => views.value.reduce((s, f) => s + f.annualFen, 0));

  const upcoming = computed(() =>
    [...views.value].sort((a, b) => a.daysToDue - b.daysToDue).slice(0, 5),
  );

  /** 未来 12 个月每个月要付多少 */
  const next12Months = computed(() => {
    const out: Array<{ month: string; amountFen: number }> = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let sum = 0;
      for (const f of items.value) {
        const step = CYCLE_MONTHS[f.cycle];
        const start = f.dueDate;
        // 判断该月是否落在扣款周期上
        const [sy, sm] = start.split('-').map(Number);
        const monthsSince = (d.getFullYear() - sy) * 12 + (d.getMonth() + 1 - sm);
        if (monthsSince >= 0 && monthsSince % step === 0) sum += f.amountFen;
      }
      out.push({ month: key, amountFen: sum });
    }
    return out;
  });

  function create(input: Omit<FixedExpense, 'id' | 'createdAt'>): string {
    const id = uid();
    items.value.push({ ...input, id, createdAt: new Date().toISOString() });
    return id;
  }

  function update(id: string, patch: Partial<FixedExpense>) {
    const i = items.value.findIndex((f) => f.id === id);
    if (i >= 0) items.value[i] = { ...items.value[i], ...patch, id };
  }

  function remove(id: string) {
    items.value = items.value.filter((f) => f.id !== id);
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
    monthlyTotalFen,
    annualTotalFen,
    upcoming,
    next12Months,
    load,
    create,
    update,
    remove,
    restoreDemo,
    clearAll,
  };
});

export { CYCLE_MONTHS };
export const todayKey = todayISO;
