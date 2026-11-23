<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhShieldCheck as ShieldCheck,
  PhArrowsClockwise as ArrowsClockwise,
  PhWarning as Warning,
  PhCaretRight as CaretRight,
  PhCalendarBlank as CalendarBlank,
  PhWallet as Wallet,
  PhPlus as Plus,
} from '@phosphor-icons/vue';
import { formatFen } from '@hmm/shared';
import { useAssetsStore } from '@/stores/assets';
import { useFixedExpensesStore } from '@/stores/fixedExpenses';

const store = useAssetsStore();
const fixedStore = useFixedExpensesStore();
const router = useRouter();

onMounted(() => {
  store.load();
  fixedStore.load();
});

interface Item {
  id: string;
  kind: 'warranty' | 'replace';
  title: string;
  subtitle: string;
  date: string;
  days: number;
  amountFen?: number;
  tone: 'ok' | 'warn' | 'urgent';
}

const items = computed<Item[]>(() => {
  const out: Item[] = [];
  for (const a of store.views) {
    const wDays = Math.round(
      (new Date(a.warrantyEndDate + 'T00:00:00').getTime() - Date.now()) / 86400000,
    );
    if (a.warrantyMonths > 0 && wDays >= 0 && wDays <= 180) {
      out.push({
        id: `${a.id}-w`,
        kind: 'warranty',
        title: `${a.name} 质保到期`,
        subtitle: wDays === 0 ? '今天到期' : `还有 ${wDays} 天`,
        date: a.warrantyEndDate,
        days: wDays,
        tone: wDays <= 30 ? 'warn' : 'ok',
      });
    }
    if (a.daysToReplace <= 365) {
      out.push({
        id: `${a.id}-r`,
        kind: 'replace',
        title: `${a.name} 预计更换`,
        subtitle:
          a.daysToReplace < 0 ? `已超期 ${-a.daysToReplace} 天` : `还有 ${a.daysToReplace} 天`,
        date: a.expectedReplaceDate,
        days: a.daysToReplace,
        amountFen: a.estimatedReplaceCostFen,
        tone: a.daysToReplace < 0 ? 'urgent' : a.daysToReplace <= 90 ? 'warn' : 'ok',
      });
    }
  }
  return out.sort((x, y) => x.days - y.days);
});

const urgent = computed(() => items.value.filter((i) => i.tone !== 'ok').slice(0, 5));
const upcoming = computed(() => items.value.slice(0, 6));

const monthlyFixed = computed(() => fixedStore.monthlyTotalFen);

const next12Cost = computed(() =>
  store.views
    .filter((a) => a.daysToReplace <= 365)
    .reduce((s, a) => s + a.estimatedReplaceCostFen, 0),
);

const bigTicket = computed(() =>
  store.views
    .filter((a) => a.daysToReplace <= 365 && a.estimatedReplaceCostFen >= 200000)
    .sort((a, b) => a.daysToReplace - b.daysToReplace)
    .slice(0, 2),
);

function fmtDate(d: string) {
  const [, m, day] = d.split('-');
  return `${Number(m)}月${Number(day)}日`;
}

function money(fen?: number) {
  return fen ? `¥${formatFen(fen)}` : '—';
}
</script>

<template>
  <div class="dash">
    <section v-if="!store.items.length" class="card welcome">
      <h2>先把家里的东西记下来</h2>
      <p class="muted">
        录一件电器，填上购买日期和价格，质保什么时候到期、大概哪年该换、换新要花多少钱，系统都会算好。
      </p>
      <button class="primary" type="button" @click="router.push('/assets/new')">
        <Plus :size="18" weight="bold" />
        录入第一件资产
      </button>
    </section>

    <template v-else>
      <section class="hero card">
        <div>
          <div class="tiny">本月固定支出</div>
          <div class="big num">{{ money(monthlyFixed) }}</div>
          <div class="tiny">共 {{ fixedStore.views.length }} 项</div>
        </div>
        <div class="divider" />
        <div>
          <div class="tiny">未来 12 个月预计更换</div>
          <div class="big accent num">{{ money(next12Cost) }}</div>
          <div class="tiny">{{ store.views.filter((a) => a.daysToReplace <= 365).length }} 件资产到期</div>
        </div>
      </section>

      <section v-if="urgent.length" class="alert card">
        <div class="alert-head">
          <Warning :size="18" weight="fill" />
          <span>需要你决定的事</span>
          <span class="badge">{{ urgent.length }}</span>
        </div>
        <ul>
          <li v-for="i in urgent" :key="i.id" @click="router.push('/assets')">
            <component :is="i.kind === 'warranty' ? ShieldCheck : ArrowsClockwise" :size="18" />
            <div class="li-main">
              <div class="li-title">{{ i.title }}</div>
              <div class="tiny">{{ fmtDate(i.date) }} · {{ i.subtitle }}</div>
            </div>
            <div v-if="i.amountFen" class="li-amount num">{{ money(i.amountFen) }}</div>
            <CaretRight :size="16" class="chev" />
          </li>
        </ul>
      </section>

      <section v-if="bigTicket.length" class="grid">
        <article v-for="item in bigTicket" :key="item.id" class="card big-card">
          <div class="tiny">大额更换预估</div>
          <div class="big num accent">{{ money(item.estimatedReplaceCostFen) }}</div>
          <div class="li-title">{{ item.name }}</div>
          <div class="tiny">{{ item.expectedReplaceDate }} · {{ item.daysToReplace }} 天后</div>
          <button class="ghost-btn" @click="router.push('/assets')">
            <Wallet :size="16" />
            去看看
          </button>
        </article>
      </section>

      <section class="card">
        <div class="section-head">
          <h2>接下来要留意</h2>
          <span class="tiny">未来一年内</span>
        </div>
        <ul class="timeline">
          <li v-for="i in upcoming" :key="i.id">
            <div class="date-chip">
              <CalendarBlank :size="14" />
              {{ fmtDate(i.date) }}
            </div>
            <div class="li-main">
              <div class="li-title">{{ i.title }}</div>
              <div class="tiny">{{ i.subtitle }}</div>
            </div>
            <span class="dot-sev" :class="i.tone" />
          </li>
          <li v-if="!upcoming.length" class="none">
            <span class="tiny">未来一年没有需要处理的事，安心</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dash {
  display: grid;
  gap: var(--space-md);
}

.welcome {
  display: grid;
  gap: 10px;
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
}

.welcome h2 {
  font-size: 18px;
  font-weight: 600;
}

.primary {
  justify-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 46px;
  padding: 0 20px;
  border: none;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.hero {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  background: linear-gradient(135deg, var(--color-primary-weak), var(--color-card) 60%);
}

.divider {
  width: 1px;
  align-self: stretch;
  background: var(--color-border);
}

.big {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  margin: 2px 0;
}

.big.accent {
  color: var(--color-accent);
}

.alert {
  border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
  background: linear-gradient(180deg, var(--color-accent-weak), var(--color-card) 55%);
}

.alert-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--color-accent);
  margin-bottom: var(--space-sm);
}

.badge {
  margin-left: auto;
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-pill);
  font-size: 11px;
  padding: 1px 8px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.alert li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
}

.alert li:first-child {
  border-top: none;
}

.li-main {
  flex: 1;
  min-width: 0;
}

.li-title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.li-amount {
  font-weight: 600;
  color: var(--color-accent);
}

.chev {
  color: var(--color-text-3);
}

.grid {
  display: grid;
  gap: var(--space-md);
}

.big-card {
  display: grid;
  gap: 4px;
}

.ghost-btn {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  padding: 8px 14px;
  min-height: 40px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.section-head h2 {
  font-size: 16px;
  font-weight: 600;
}

.timeline li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}

.timeline li:first-child {
  border-top: none;
}

.timeline li.none {
  justify-content: center;
  padding: var(--space-lg) 0;
}

.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  color: var(--color-text-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.dot-sev {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--color-primary);
}

.dot-sev.warn {
  background: var(--color-accent);
}

.dot-sev.urgent {
  background: var(--color-danger);
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
