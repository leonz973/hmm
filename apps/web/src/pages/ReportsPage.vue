<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhArrowLeft as ArrowLeft,
  PhChartPieSlice as ChartPie,
  PhTrendUp as TrendUp,
  PhDoor as Door,
  PhCalendarBlank as Calendar,
} from '@phosphor-icons/vue';
import { formatFen } from '@hmm/shared';
import { useAssetsStore } from '@/stores/assets';
import { useFixedExpensesStore } from '@/stores/fixedExpenses';
import { useBillsStore } from '@/stores/bills';
import { useInvoicesStore } from '@/stores/invoices';

const router = useRouter();
const assets = useAssetsStore();
const fixed = useFixedExpensesStore();
const bills = useBillsStore();
const invoices = useInvoicesStore();

onMounted(() => {
  assets.load();
  fixed.load();
  bills.load();
  invoices.load();
});

const year = new Date().getFullYear();

const totals = computed(() => ({
  fixed: fixed.annualTotalFen,
  bills: bills.yearTotalFen,
  invoices: invoices.thisYearFen,
}));

const totalYearFen = computed(() => totals.value.fixed + totals.value.bills + totals.value.invoices);

/** 支出构成：百分比条 */
const spendRows = computed(() => {
  const t = totalYearFen.value || 1;
  return [
    { label: '固定支出', fen: totals.value.fixed, pct: Math.round((totals.value.fixed / t) * 100), color: 'var(--color-primary)' },
    { label: '生活账单', fen: totals.value.bills, pct: Math.round((totals.value.bills / t) * 100), color: 'var(--color-accent)' },
    { label: '大件采购（发票）', fen: totals.value.invoices, pct: Math.round((totals.value.invoices / t) * 100), color: '#6366f1' },
  ];
});

function groupBy(list: Array<{ key: string; fen: number }>) {
  const map = new Map<string, { fen: number; count: number }>();
  for (const item of list) {
    const cur = map.get(item.key) ?? { fen: 0, count: 0 };
    cur.fen += item.fen;
    cur.count += 1;
    map.set(item.key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key: key || '未填写', ...v }))
    .sort((a, b) => b.fen - a.fen);
}

const byCategory = computed(() =>
  groupBy(assets.activeViews.map((a) => ({ key: a.categoryName, fen: a.priceFen }))),
);
const byRoom = computed(() => groupBy(assets.activeViews.map((a) => ({ key: a.location, fen: a.priceFen }))));

const deprecation = computed(() => {
  const bought = assets.totalValueFen;
  const residual = assets.totalResidualFen;
  const lost = Math.max(0, bought - residual);
  return { bought, residual, lost, pct: bought ? Math.round((lost / bought) * 100) : 0 };
});

/** 未来三年：换新 + 固定支出 */
const future = computed(() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 3 }, (_, i) => {
    const y = now + i;
    const replaceFen = assets.activeViews
      .filter((a) => a.expectedReplaceDate.startsWith(String(y)))
      .reduce((s, a) => s + a.estimatedReplaceCostFen, 0);
    return { year: y, replaceFen, fixedFen: fixed.annualTotalFen, total: replaceFen + fixed.annualTotalFen };
  });
});

const futureMax = computed(() => Math.max(1, ...future.value.map((f) => f.total)));

const money = (fen: number) => formatFen(fen);
</script>

<template>
  <div class="page">
    <button class="back" type="button" @click="router.back()">
      <ArrowLeft :size="18" />
      返回
    </button>

    <div class="head">
      <h1>统计报表</h1>
      <span class="tiny muted">{{ year }} 年 · 按当前记录实时算</span>
    </div>

    <section class="card hero">
      <div class="tiny muted">今年看得见的支出</div>
      <div class="big num">{{ money(totalYearFen) }}</div>
      <div class="tiny muted">固定支出 + 生活账单 + 大件采购，合计</div>
      <div class="bars">
        <div v-for="row in spendRows" :key="row.label" class="bar-row">
          <span class="bar-label tiny">{{ row.label }}</span>
          <div class="track"><span class="fill" :style="{ width: row.pct + '%', background: row.color }" /></div>
          <span class="bar-value num">{{ money(row.fen) }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="section-title">
        <ChartPie :size="18" />
        <span>钱都压在什么品类上</span>
      </div>
      <p class="tiny muted">按买入价算，只看在用的东西。</p>
      <ul v-if="byCategory.length" class="rank">
        <li v-for="c in byCategory" :key="c.key">
          <span class="rank-name">{{ c.key }}<span class="tiny muted"> · {{ c.count }} 件</span></span>
          <div class="track"><span class="fill" :style="{ width: Math.round((c.fen / (byCategory[0].fen || 1)) * 100) + '%' }" /></div>
          <span class="num">{{ money(c.fen) }}</span>
        </li>
      </ul>
      <p v-else class="tiny muted">还没有资产记录。</p>
    </section>

    <section class="card">
      <div class="section-title">
        <Door :size="18" />
        <span>按房间看</span>
      </div>
      <ul v-if="byRoom.length" class="rank">
        <li v-for="r in byRoom" :key="r.key">
          <span class="rank-name">{{ r.key }}<span class="tiny muted"> · {{ r.count }} 件</span></span>
          <div class="track"><span class="fill accent" :style="{ width: Math.round((r.fen / (byRoom[0].fen || 1)) * 100) + '%' }" /></div>
          <span class="num">{{ money(r.fen) }}</span>
        </li>
      </ul>
      <p v-else class="tiny muted">还没有资产记录。</p>
    </section>

    <section class="card">
      <div class="section-title">
        <TrendUp :size="18" />
        <span>折旧与残值</span>
      </div>
      <div class="dep">
        <div>
          <div class="tiny muted">买入总价</div>
          <div class="num strong">{{ money(deprecation.bought) }}</div>
        </div>
        <div>
          <div class="tiny muted">当前残值</div>
          <div class="num strong accent">{{ money(deprecation.residual) }}</div>
        </div>
        <div>
          <div class="tiny muted">已折旧</div>
          <div class="num strong">{{ money(deprecation.lost) }}</div>
        </div>
      </div>
      <div class="track thick">
        <span class="fill" :style="{ width: 100 - deprecation.pct + '%' }" />
      </div>
      <p class="tiny muted">家当已经折旧掉 {{ deprecation.pct }}%，剩下的 {{ 100 - deprecation.pct }}% 是账面残值。</p>
    </section>

    <section class="card">
      <div class="section-title">
        <Calendar :size="18" />
        <span>未来三年的资金压力</span>
      </div>
      <p class="tiny muted">换新预估（含通胀）+ 固定支出，看看哪一年最紧。</p>
      <div class="years">
        <div v-for="f in future" :key="f.year" class="year-col">
          <div class="year-stack">
            <span class="seg replace" :style="{ height: Math.round((f.replaceFen / futureMax) * 100) + '%' }" />
            <span class="seg fixed" :style="{ height: Math.round((f.fixedFen / futureMax) * 100) + '%' }" />
          </div>
          <div class="num small">{{ money(f.total) }}</div>
          <div class="tiny muted">{{ f.year }}</div>
        </div>
      </div>
      <div class="legend tiny muted">
        <span><i class="dot replace" />换新</span>
        <span><i class="dot fixed" />固定支出</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  color: var(--color-muted);
  font: inherit;
  cursor: pointer;
  padding: 0;
  width: fit-content;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}
h1 {
  margin: 0;
  font-size: 20px;
}
.hero {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.big {
  font-size: 28px;
  font-weight: 700;
  margin: 2px 0;
}
.bars {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bar-row {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: var(--space-sm);
}
.track {
  height: 8px;
  border-radius: 999px;
  background: var(--color-bg);
  overflow: hidden;
}
.track.thick {
  height: 12px;
  margin: var(--space-md) 0 8px;
}
.fill {
  display: block;
  height: 100%;
  background: var(--color-primary);
  border-radius: 999px;
}
.fill.accent {
  background: var(--color-accent);
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.rank {
  list-style: none;
  margin: var(--space-md) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rank li {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  align-items: center;
  gap: var(--space-sm);
}
.dep {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-top: var(--space-md);
}
.years {
  display: flex;
  align-items: flex-end;
  gap: var(--space-lg);
  margin-top: var(--space-md);
  height: 180px;
}
.year-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.year-stack {
  width: 100%;
  height: 130px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
}
.seg {
  display: block;
  width: 100%;
  border-radius: 4px;
}
.seg.replace {
  background: #6366f1;
}
.seg.fixed {
  background: var(--color-primary);
}
.legend {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-sm);
}
.legend .dot,
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.dot.replace {
  background: #6366f1;
}
.dot.fixed {
  background: var(--color-primary);
}
.small {
  font-size: 13px;
}
@media (max-width: 520px) {
  .bar-row,
  .rank li {
    grid-template-columns: 88px 1fr auto;
  }
}
</style>
