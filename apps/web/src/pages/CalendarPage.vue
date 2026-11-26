<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  PhCaretLeft as CaretLeft,
  PhCaretRight as CaretRight,
  PhShieldCheck as ShieldCheck,
  PhArrowsClockwise as ArrowsClockwise,
  PhWallet as Wallet,
} from '@phosphor-icons/vue';
import { formatFen } from '@hmm/shared';
import { useAssetsStore } from '@/stores/assets';
import { useFixedExpensesStore, CYCLE_MONTHS } from '@/stores/fixedExpenses';
import { useBillsStore } from '@/stores/bills';

const store = useAssetsStore();
const fixedStore = useFixedExpensesStore();
const billsStore = useBillsStore();
onMounted(() => {
  store.load();
  fixedStore.load();
  billsStore.load();
});

type EvKind = 'warranty' | 'replace' | 'bill';
interface Ev {
  kind: EvKind;
  title: string;
  detail: string;
  amountFen?: number;
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

const today = new Date();
const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1));

const todayKey = key(today);
function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const monthLabel = computed(() => `${cursor.value.getFullYear()} 年 ${cursor.value.getMonth() + 1} 月`);

/** 本月 1 号所在周的周一，向前对齐，铺满 6 周 */
const gridStart = computed(() => {
  const first = new Date(cursor.value);
  const weekday = (first.getDay() + 6) % 7; // 周一=0
  first.setDate(first.getDate() - weekday);
  return first;
});

const days = computed(() => {
  const out: Array<{ date: Date; key: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.value);
    d.setDate(d.getDate() + i);
    out.push({ date: d, key: key(d), inMonth: d.getMonth() === cursor.value.getMonth() });
  }
  return out;
});

/** 把资产与固定支出摊成本月每一天的事件 */
const events = computed<Record<string, Ev[]>>(() => {
  const map: Record<string, Ev[]> = {};
  const push = (dateKey: string, ev: Ev) => {
    (map[dateKey] ||= []).push(ev);
  };

  for (const a of store.activeViews) {
    if (a.warrantyMonths > 0) {
      push(a.warrantyEndDate, {
        kind: 'warranty',
        title: `${a.name} 质保到期`,
        detail: a.location,
      });
    }
    push(a.expectedReplaceDate, {
      kind: 'replace',
      title: `${a.name} 预计更换`,
      detail: `预估 ¥${formatFen(a.estimatedReplaceCostFen)}`,
      amountFen: a.estimatedReplaceCostFen,
    });
  }

  const y = cursor.value.getFullYear();
  const m = cursor.value.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');

  // 固定支出：按周期判断本月是否该扣
  for (const f of fixedStore.items) {
    const [ay, am, ad] = f.dueDate.split('-').map(Number);
    const step = CYCLE_MONTHS[f.cycle];
    const diff = (y - ay) * 12 + (m + 1 - am);
    if (diff < 0 || diff % step !== 0) continue;
    push(`${y}-${pad(m + 1)}-${pad(ad)}`, {
      kind: 'bill',
      title: f.name,
      detail: `固定支出 · ${f.cycle}`,
      amountFen: f.amountFen,
    });
  }

  // 水电燃气账单：到期日落在本月
  for (const b of billsStore.views) {
    if (!b.dueDate.startsWith(`${y}-${pad(m + 1)}`)) continue;
    push(b.dueDate, {
      kind: 'bill',
      title: `${b.type} ${b.period}`,
      detail: b.isPaid ? '已缴' : '待缴',
      amountFen: b.amountFen,
    });
  }
  return map;
});

const selected = ref(todayKey);
const selectedEvents = computed(() => events.value[selected.value] ?? []);

const monthStats = computed(() => {
  const prefix = `${cursor.value.getFullYear()}-${String(cursor.value.getMonth() + 1).padStart(2, '0')}`;
  let count = 0;
  let money = 0;
  for (const [k, list] of Object.entries(events.value)) {
    if (!k.startsWith(prefix)) continue;
    for (const ev of list) {
      count++;
      if (ev.amountFen) money += ev.amountFen;
    }
  }
  return { count, money };
});

function move(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1);
}

function goToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1);
  selected.value = todayKey;
}

function kindIcon(kind: EvKind) {
  return kind === 'warranty' ? ShieldCheck : kind === 'replace' ? ArrowsClockwise : Wallet;
}
</script>

<template>
  <div class="page">
    <div class="head">
      <h1>到期日历</h1>
      <button class="ghost" type="button" @click="goToday">回到今天</button>
    </div>

    <section class="card">
      <div class="month-bar">
        <button class="icon-btn" type="button" aria-label="上个月" @click="move(-1)">
          <CaretLeft :size="18" />
        </button>
        <strong>{{ monthLabel }}</strong>
        <button class="icon-btn" type="button" aria-label="下个月" @click="move(1)">
          <CaretRight :size="18" />
        </button>
      </div>

      <div class="weekday">
        <span v-for="w in WEEK" :key="w">{{ w }}</span>
      </div>

      <div class="grid">
        <button
          v-for="d in days"
          :key="d.key"
          type="button"
          class="cell"
          :class="{ out: !d.inMonth, today: d.key === todayKey, active: d.key === selected }"
          @click="selected = d.key"
        >
          <span class="dnum">{{ d.date.getDate() }}</span>
          <span class="dots">
            <i v-for="(ev, i) in (events[d.key] ?? []).slice(0, 3)" :key="i" :class="ev.kind" />
          </span>
        </button>
      </div>

      <div class="stat tiny">
        本月 {{ monthStats.count }} 件待办 · 涉及金额 ¥{{ formatFen(monthStats.money) }}
      </div>
    </section>

    <section class="card">
      <h2>{{ selected }} 这天</h2>
      <ul v-if="selectedEvents.length">
        <li v-for="(ev, i) in selectedEvents" :key="i">
          <component :is="kindIcon(ev.kind)" :size="18" :class="ev.kind" />
          <div class="li-main">
            <div class="li-title">{{ ev.title }}</div>
            <div class="tiny">{{ ev.detail }}</div>
          </div>
          <span v-if="ev.amountFen" class="num amount">¥{{ formatFen(ev.amountFen) }}</span>
        </li>
      </ul>
      <p v-else class="tiny none">这天没有安排</p>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-md);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h1 {
  font-size: 20px;
  font-weight: 600;
}

h2 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

.ghost {
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-2);
  font-size: 13px;
}

.month-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-2);
}

.weekday {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 4px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cell {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 4px;
  min-height: 46px;
  padding: 6px 0 4px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.cell:hover {
  background: var(--color-bg);
}

.cell.out {
  color: var(--color-text-3);
  opacity: 0.45;
}

.cell.today .dnum {
  color: var(--color-primary);
  font-weight: 700;
}

.cell.active {
  background: var(--color-primary-weak);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.dnum {
  font-size: 13px;
}

.dots {
  display: flex;
  gap: 3px;
  height: 6px;
}

.dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: block;
}

.dots i.warranty {
  background: var(--color-primary);
}

.dots i.replace {
  background: var(--color-accent);
}

.dots i.bill {
  background: var(--color-text-3);
}

.stat {
  margin-top: var(--space-md);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
  text-align: center;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}

li:first-child {
  border-top: none;
}

li svg.warranty {
  color: var(--color-primary);
}

li svg.replace {
  color: var(--color-accent);
}

li svg.bill {
  color: var(--color-text-3);
}

.li-main {
  flex: 1;
  min-width: 0;
}

.li-title {
  font-weight: 500;
}

.amount {
  font-weight: 600;
  color: var(--color-accent);
}

.none {
  padding: var(--space-lg) 0;
  text-align: center;
}
</style>
