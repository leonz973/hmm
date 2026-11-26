<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhPlus as Plus,
  PhMagnifyingGlass as MagnifyingGlass,
  PhCube as Cube,
  PhCaretRight as CaretRight,
} from '@phosphor-icons/vue';
import { formatFen } from '@hmm/shared';
import { useAssetsStore } from '@/stores/assets';
import { useInvoicesStore } from '@/stores/invoices';

const store = useAssetsStore();
const invoices = useInvoicesStore();
const router = useRouter();
const keyword = ref('');

onMounted(() => {
  store.load();
  invoices.load();
});

/** 资产 id → 关联发票数量 */
const invoiceCount = computed(() => {
  const m = new Map<string, number>();
  for (const inv of invoices.items) for (const id of inv.assetIds) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
});

const filtered = computed(() => {
  const kw = keyword.value.trim();
  if (!kw) return store.sortedViews;
  return store.sortedViews.filter(
    (a) => a.name.includes(kw) || a.categoryName.includes(kw) || a.location.includes(kw),
  );
});

const summary = computed(() => ({
  count: store.items.length,
  total: store.totalValueFen,
  residual: store.totalResidualFen,
}));

function statusText(days: number): { text: string; tone: 'ok' | 'warn' | 'urgent' } {
  if (days < 0) return { text: `已超期 ${-days} 天`, tone: 'urgent' };
  if (days <= 90) return { text: `${days} 天后该换`, tone: 'urgent' };
  if (days <= 365) return { text: `${days} 天后该换`, tone: 'warn' };
  return { text: `还能用约 ${Math.round(days / 30)} 个月`, tone: 'ok' };
}

function toForm(id: string) {
  void router.push(`/assets/${id}/edit`);
}
</script>

<template>
  <div class="page">
    <div class="head">
      <h1>资产台账</h1>
      <button class="primary" type="button" @click="router.push('/assets/new')">
        <Plus :size="18" weight="bold" />
        录入
      </button>
    </div>

    <section v-if="summary.count" class="card summary">
      <div>
        <div class="tiny">在册</div>
        <div class="num strong">{{ summary.count }} 件</div>
      </div>
      <div>
        <div class="tiny">购入总价</div>
        <div class="num strong">¥{{ formatFen(summary.total) }}</div>
      </div>
      <div>
        <div class="tiny">当前残值</div>
        <div class="num strong accent">¥{{ formatFen(summary.residual) }}</div>
      </div>
    </section>

    <label class="search">
      <MagnifyingGlass :size="18" />
      <input v-model="keyword" type="search" placeholder="搜索名称、品类或房间" />
    </label>

    <div v-if="filtered.length" class="list">
      <button
        v-for="a in filtered"
        :key="a.id"
        class="card asset"
        :class="{ retired: a.status === 'replaced' }"
        type="button"
        @click="toForm(a.id)"
      >
        <div class="icon-wrap">
          <Cube :size="22" />
        </div>
        <div class="main">
          <div class="title-row">
            <span class="title">{{ a.name }}</span>
            <span v-if="a.status === 'replaced'" class="status replaced">已换新</span>
            <span v-else class="status" :class="statusText(a.daysToReplace).tone">
              {{ statusText(a.daysToReplace).text }}
            </span>
          </div>
          <div class="tiny">
            {{ a.categoryName }} · {{ a.location }} · {{ a.purchaseDate }} 购入 · ¥{{ formatFen(a.priceFen) }}
          </div>
          <div class="bar" :title="`已使用 ${a.lifeUsedPercent}% 寿命`">
            <span :style="{ width: a.lifeUsedPercent + '%' }" :class="{ hot: a.lifeUsedPercent > 80 }" />
          </div>
          <div class="tiny meta">
            质保 {{ a.warrantyMonths ? `至 ${a.warrantyEndDate}` : '无' }} · 换新约 ¥{{
              formatFen(a.estimatedReplaceCostFen)
            }}
            <template v-if="invoiceCount.get(a.id)">
              · {{ invoiceCount.get(a.id) }} 张发票
            </template>
          </div>
        </div>
        <CaretRight :size="16" class="chev" />
      </button>
    </div>

    <div v-else-if="summary.count" class="card empty">
      <p>没有匹配「{{ keyword }}」的资产</p>
      <p class="tiny">换个关键词试试</p>
    </div>

    <div v-else class="card empty">
      <Cube :size="40" />
      <p>还没录入任何资产</p>
      <p class="tiny">先录一件家里的电器试试，质保和换新时间就自动算好了</p>
      <button class="primary mt" type="button" @click="router.push('/assets/new')">
        <Plus :size="18" weight="bold" />
        录入第一件
      </button>
    </div>
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
  gap: var(--space-md);
}

h1 {
  font-size: 20px;
  font-weight: 600;
}

.primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px;
  border: none;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.primary:hover {
  background: var(--color-primary-hover);
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  padding: var(--space-md);
}

.strong {
  font-size: 16px;
  font-weight: 600;
}

.strong.accent {
  color: var(--color-accent);
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  min-height: 44px;
  border-radius: var(--radius-control);
  background: var(--color-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-3);
}

.search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
}

.list {
  display: grid;
  gap: var(--space-sm);
}

.asset {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: var(--space-md);
  text-align: left;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s var(--ease-out), transform 0.1s var(--ease-out);
}

.asset:hover {
  border-color: var(--color-primary);
}

.asset:active {
  transform: scale(0.995);
}

.icon-wrap {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 12px;
  background: var(--color-primary-weak);
  color: var(--color-primary);
}

.main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-weak);
  color: var(--color-primary);
}

.status.warn {
  background: var(--color-accent-weak);
  color: var(--color-accent);
}

.status.urgent {
  background: var(--color-danger-weak);
  color: var(--color-danger);
}

.bar {
  height: 5px;
  margin-top: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s var(--ease-out);
}

.bar span.hot {
  background: var(--color-accent);
}

.meta {
  margin-top: 4px;
}

.asset.retired {
  opacity: 0.62;
}

.status.replaced {
  background: #eef2f0;
  color: var(--color-text-3);
}

.chev {
  color: var(--color-text-3);
  flex: none;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: var(--space-2xl) var(--space-md);
  color: var(--color-text-3);
  text-align: center;
}

.mt {
  margin-top: var(--space-md);
}
</style>
