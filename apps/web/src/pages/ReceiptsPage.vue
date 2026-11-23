<script setup lang="ts">
import {
  PhReceipt as Receipt,
  PhDrop as Drop,
  PhLightning as Lightning,
  PhFire as Fire,
  PhBuildings as Buildings,
} from '@phosphor-icons/vue';
import { formatFen } from '@hmm/shared';

const bills = [
  { id: 'b1', type: '电费', icon: Lightning, period: '2026-10', amountFen: 23860, usage: '312 度' },
  { id: 'b2', type: '水费', icon: Drop, period: '2026-10', amountFen: 8640, usage: '18 吨' },
  { id: 'b3', type: '燃气费', icon: Fire, period: '2026-10', amountFen: 11200, usage: '23 立方' },
  { id: 'b4', type: '物业费', icon: Buildings, period: '2026-10', amountFen: 32000, usage: '—' },
];
</script>

<template>
  <div class="page">
    <h1>票据与账单</h1>

    <section class="card">
      <h2>最近账单（演示）</h2>
      <ul>
        <li v-for="b in bills" :key="b.id">
          <component :is="b.icon" :size="18" />
          <span class="name">{{ b.type }}</span>
          <span class="tiny">{{ b.period }} · {{ b.usage }}</span>
          <span class="num amount">¥{{ formatFen(b.amountFen) }}</span>
        </li>
      </ul>
    </section>

    <div class="card placeholder">
      <Receipt :size="40" />
      <p>发票存档在 M5 交付</p>
      <p class="tiny">支持拍照/PDF 上传、关联资产、按商家与金额检索</p>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-md);
}

h1 {
  font-size: 20px;
  font-weight: 600;
}

h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
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

.name {
  font-weight: 500;
}

.amount {
  margin-left: auto;
  font-weight: 600;
}

.placeholder {
  display: grid;
  justify-items: center;
  gap: 6px;
  text-align: center;
  color: var(--color-text-3);
  padding: var(--space-2xl) var(--space-md);
}
</style>
