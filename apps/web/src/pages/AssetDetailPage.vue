<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  PhArrowLeft as ArrowLeft,
  PhPencilSimple as Pencil,
  PhArrowsClockwise as Replace,
  PhPlus as Plus,
  PhCheck as Check,
  PhTrash as Trash,
  PhReceipt as Receipt,
  PhWrench as Wrench,
} from '@phosphor-icons/vue';
import { formatFen } from '@hmm/shared';
import { useAssetsStore } from '@/stores/assets';
import { useInvoicesStore } from '@/stores/invoices';
import { useMaintenanceStore } from '@/stores/maintenance';
import { todayISO } from '@/lib/persist';

const route = useRoute();
const router = useRouter();
const assets = useAssetsStore();
const invoices = useInvoicesStore();
const plans = useMaintenanceStore();

const assetId = computed(() => String(route.params.id ?? ''));
const asset = computed(() => assets.views.find((a) => a.id === assetId.value));

onMounted(() => {
  assets.load();
  invoices.load();
  plans.load();
});

const relatedInvoices = computed(() => invoices.items.filter((i) => i.assetIds.includes(assetId.value)));

const warranty = computed(() => {
  const a = asset.value;
  if (!a || !a.warrantyEndDate) return null;
  const days = Math.round((new Date(a.warrantyEndDate).getTime() - Date.now()) / 86_400_000);
  return { date: a.warrantyEndDate, days, expired: days < 0 };
});

const replacement = computed(() => {
  const a = asset.value;
  if (!a || !a.expectedReplaceDate) return null;
  return { date: a.expectedReplaceDate, days: a.daysToReplace };
});

// —— 保养计划 ——
const showForm = ref(false);
const form = ref({ title: '换滤芯', intervalMonths: 3, lastDoneDate: todayISO() });
const saving = ref(false);
const error = ref('');

const PRESETS = [
  { title: '清洗滤网', months: 1 },
  { title: '换滤芯', months: 3 },
  { title: '深度清洁', months: 6 },
  { title: '检修保养', months: 12 },
];

function openForm(title = '换滤芯', months = 3) {
  form.value = { title, intervalMonths: months, lastDoneDate: todayISO() };
  error.value = '';
  showForm.value = true;
}

async function savePlan() {
  const title = form.value.title.trim();
  if (!title) {
    error.value = '写个名字，比如「换滤芯」';
    return;
  }
  if (form.value.intervalMonths < 1) {
    error.value = '周期至少 1 个月';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await plans.create({
      assetId: assetId.value,
      title,
      intervalMonths: form.value.intervalMonths,
      lastDoneDate: form.value.lastDoneDate,
    });
    showForm.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

async function markDone(id: string) {
  await plans.done(id, todayISO());
}

async function removePlan(id: string) {
  if (!confirm('删掉这条保养计划？')) return;
  await plans.remove(id);
}

const myPlans = computed(() => plans.byAsset(assetId.value));

function tone(days: number): 'ok' | 'warn' | 'urgent' {
  if (days < 0) return 'urgent';
  if (days <= 30) return 'urgent';
  if (days <= 90) return 'warn';
  return 'ok';
}

function daysText(days: number): string {
  if (days < 0) return `已超期 ${-days} 天`;
  if (days === 0) return '就是今天';
  return `${days} 天后`;
}
</script>

<template>
  <div class="page">
    <button class="back" type="button" @click="router.back()">
      <ArrowLeft :size="18" />
      返回
    </button>

    <div v-if="!asset" class="card empty">
      <p>没找到这件东西，可能已经被删掉了。</p>
      <button class="mini" type="button" @click="router.push('/assets')">回资产台账</button>
    </div>

    <template v-else>
      <section class="card hero">
        <div class="hero-head">
          <div>
            <h1>{{ asset.name }}</h1>
            <p class="muted tiny">
              {{ asset.categoryName || '未分类' }} · {{ asset.location || '没写房间' }} · 购于
              {{ asset.purchaseDate || '—' }}
            </p>
          </div>
          <span v-if="asset.status === 'replaced'" class="chip">已换新</span>
        </div>

        <div class="grid">
          <div class="stat">
            <span class="tiny muted">买入价</span>
            <strong class="num">{{ formatFen(asset.priceFen) }}</strong>
          </div>
          <div class="stat">
            <span class="tiny muted">当前残值</span>
            <strong class="num">{{ formatFen(asset.residualValueFen) }}</strong>
          </div>
          <div class="stat">
            <span class="tiny muted">质保</span>
            <strong v-if="warranty" class="num" :class="warranty.expired ? 'urgent' : ''">
              {{ warranty.expired ? '已过保' : daysText(warranty.days) }}
            </strong>
            <strong v-else class="num muted">未记录</strong>
            <span v-if="warranty" class="tiny muted">到 {{ warranty.date }}</span>
          </div>
          <div class="stat">
            <span class="tiny muted">预计换新</span>
            <strong v-if="replacement" class="num" :class="tone(replacement.days)">
              {{ daysText(replacement.days) }}
            </strong>
            <strong v-else class="num muted">未记录</strong>
            <span v-if="replacement" class="tiny muted">换新约 {{ formatFen(asset.estimatedReplaceCostFen) }}</span>
          </div>
        </div>

        <div class="hero-actions">
          <button class="mini" type="button" @click="router.push(`/assets/${asset.id}/edit`)">
            <Pencil :size="16" />
            改资料
          </button>
          <button
            v-if="asset.status !== 'replaced'"
            class="mini"
            type="button"
            @click="router.push(`/assets/${asset.id}/edit?replace=1`)"
          >
            <Replace :size="16" />
            记录换新
          </button>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div class="section-title">
            <Wrench :size="18" />
            <span>保养计划</span>
          </div>
          <button class="mini" type="button" @click="openForm()">
            <Plus :size="16" />
            加一条
          </button>
        </div>
        <p class="tiny muted">
          清洗滤网、换滤芯这类事，按周期记下来，到期会出现在首页提醒里。
        </p>

        <ul v-if="myPlans.length" class="plans">
          <li v-for="p in myPlans" :key="p.id" class="plan">
            <div class="plan-main">
              <strong>{{ p.title }}</strong>
              <span class="tiny muted">每 {{ p.intervalMonths }} 个月 · 上次 {{ p.lastDoneDate || '—' }}</span>
            </div>
            <div class="plan-side">
              <span class="tiny" :class="tone(p.daysLeft)">{{ daysText(p.daysLeft) }}</span>
              <span class="tiny muted">下次 {{ p.nextDueDate }}</span>
            </div>
            <div class="plan-actions">
              <button class="icon-btn" type="button" title="这次做完了" @click="markDone(p.id)">
                <Check :size="16" />
              </button>
              <button class="icon-btn danger" type="button" title="删除" @click="removePlan(p.id)">
                <Trash :size="16" />
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="tiny muted empty-line">还没有保养计划。</p>

        <div v-if="showForm" class="form">
          <div class="presets">
            <button
              v-for="preset in PRESETS"
              :key="preset.title"
              class="pick"
              type="button"
              @click="form.title = preset.title, form.intervalMonths = preset.months"
            >
              {{ preset.title }}
            </button>
          </div>
          <div class="row">
            <label class="field">
              <span class="tiny muted">做什么</span>
              <input v-model="form.title" placeholder="换滤芯" />
            </label>
            <label class="field">
              <span class="tiny muted">每几个月</span>
              <input v-model.number="form.intervalMonths" type="number" min="1" max="120" />
            </label>
            <label class="field">
              <span class="tiny muted">上次做是</span>
              <input v-model="form.lastDoneDate" type="date" />
            </label>
          </div>
          <p v-if="error" class="err tiny">{{ error }}</p>
          <div class="form-actions">
            <button class="mini" type="button" @click="showForm = false">取消</button>
            <button class="mini primary" type="button" :disabled="saving" @click="savePlan">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div class="section-title">
            <Receipt :size="18" />
            <span>发票与凭证</span>
          </div>
          <button class="mini" type="button" @click="router.push('/receipts')">去账目页</button>
        </div>
        <ul v-if="relatedInvoices.length" class="invoices">
          <li v-for="inv in relatedInvoices" :key="inv.id">
            <strong>{{ inv.seller }}</strong>
            <span class="tiny muted">{{ inv.date }} · {{ inv.kind || '未分类' }}</span>
            <span class="num">{{ formatFen(inv.amountFen) }}</span>
          </li>
        </ul>
        <p v-else class="tiny muted empty-line">这件东西还没挂发票。到账目页的发票 tab 里上传时选上它就行。</p>
      </section>
    </template>
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
.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}
h1 {
  margin: 0 0 4px;
  font-size: 20px;
}
.chip {
  background: var(--color-bg);
  color: var(--color-muted);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-md);
  margin-top: var(--space-md);
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat strong {
  font-size: 18px;
}
.urgent {
  color: #dc2626;
}
.warn {
  color: var(--color-accent);
}
.ok {
  color: var(--color-muted);
}
.hero-actions,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}
.section-head {
  margin-top: 0;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.plans,
.invoices {
  list-style: none;
  margin: var(--space-md) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.plan {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e6e9e4);
  border-radius: var(--radius-control);
}
.plan-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.plan-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.plan-actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  border: 1px solid var(--color-border, #e6e9e4);
  background: var(--color-card);
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--color-muted);
}
.icon-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.icon-btn.danger:hover {
  color: #dc2626;
  border-color: #dc2626;
}
.invoices li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 8px;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e6e9e4);
  border-radius: var(--radius-control);
}
.invoices li span {
  grid-column: 1;
}
.invoices li .num {
  grid-row: 1 / span 2;
  grid-column: 2;
  align-self: center;
}
.form {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px dashed var(--color-border, #e6e9e4);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pick {
  border: 1px solid var(--color-border, #e6e9e4);
  background: var(--color-bg);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 120px;
}
.field input {
  border: 1px solid var(--color-border, #e6e9e4);
  border-radius: var(--radius-control);
  padding: 8px 10px;
  font: inherit;
  background: var(--color-card);
  color: var(--color-text);
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
.mini.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
.err {
  color: #dc2626;
}
.empty,
.empty-line {
  text-align: center;
}
.empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: center;
}
</style>
