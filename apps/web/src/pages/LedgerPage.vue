<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  PhPlus as Plus,
  PhTrash as Trash,
  PhPencilSimple as Pencil,
  PhCheckCircle as CheckCircle,
  PhClock as Clock,
  PhWallet as Wallet,
  PhX as X,
} from '@phosphor-icons/vue';
import { currentMonth, money, todayISO } from '@/lib/persist';
import InvoicePanel from '@/components/InvoicePanel.vue';
import { BILL_TYPES, useBillsStore, type BillType } from '@/stores/bills';
import {
  useFixedExpensesStore,
  type ExpenseCycle,
  type FixedExpense,
} from '@/stores/fixedExpenses';

const tab = ref<'fixed' | 'bills' | 'invoices'>('fixed');

const fixed = useFixedExpensesStore();
const bills = useBillsStore();

onMounted(() => {
  fixed.load();
  bills.load();
});

/* ───────────────── 固定支出 ───────────────── */
const expenseModal = ref(false);
const editingExpenseId = ref<string | null>(null);
const expenseForm = reactive({
  name: '',
  amountYuan: '',
  cycle: '每月' as ExpenseCycle,
  dueDate: todayISO(),
  category: '居住' as FixedExpense['category'],
  autoPay: true,
  note: '',
});
const expenseError = ref('');

const CYCLES: ExpenseCycle[] = ['每月', '每季', '每半年', '每年'];
const CATEGORIES: Array<FixedExpense['category']> = ['居住', '交通', '保险', '通讯', '订阅', '教育', '其他'];

function openExpense(item?: FixedExpense) {
  expenseError.value = '';
  if (item) {
    editingExpenseId.value = item.id;
    expenseForm.name = item.name;
    expenseForm.amountYuan = (item.amountFen / 100).toFixed(2);
    expenseForm.cycle = item.cycle;
    expenseForm.dueDate = item.dueDate;
    expenseForm.category = item.category;
    expenseForm.autoPay = item.autoPay;
    expenseForm.note = item.note ?? '';
  } else {
    editingExpenseId.value = null;
    expenseForm.name = '';
    expenseForm.amountYuan = '';
    expenseForm.cycle = '每月';
    expenseForm.dueDate = todayISO();
    expenseForm.category = '居住';
    expenseForm.autoPay = true;
    expenseForm.note = '';
  }
  expenseModal.value = true;
}

async function saveExpense() {
  const amount = Math.round(Number(expenseForm.amountYuan) * 100);
  if (!expenseForm.name.trim()) return void (expenseError.value = '填个名称');
  if (!Number.isFinite(amount) || amount <= 0) return void (expenseError.value = '金额要大于 0');
  if (!expenseForm.dueDate) return void (expenseError.value = '选一个扣款日期');

  const payload = {
    name: expenseForm.name.trim(),
    amountFen: amount,
    cycle: expenseForm.cycle,
    dueDate: expenseForm.dueDate,
    category: expenseForm.category,
    autoPay: expenseForm.autoPay,
    note: expenseForm.note.trim() || undefined,
  };
  if (editingExpenseId.value) await fixed.update(editingExpenseId.value, payload);
  else await fixed.create(payload);
  expenseModal.value = false;
}

/* ───────────────── 账单 ───────────────── */
const billModal = ref(false);
const billForm = reactive({
  type: '电费' as BillType,
  period: currentMonth(),
  amountYuan: '',
  usage: '',
  dueDate: '',
  note: '',
});
const billError = ref('');

const selectedMonth = ref<string>(currentMonth());

const billMonthOptions = computed(() => {
  const set = new Set<string>(bills.months);
  set.add(currentMonth());
  return [...set].sort().reverse();
});

const monthBills = computed(() => bills.byPeriod[selectedMonth.value] ?? []);
const monthTotal = computed(() => monthBills.value.reduce((s, b) => s + b.amountFen, 0));
const momChange = computed(() => bills.monthOverMonth(selectedMonth.value));

function openBill() {
  billError.value = '';
  billForm.type = '电费';
  billForm.period = selectedMonth.value || currentMonth();
  billForm.amountYuan = '';
  billForm.usage = '';
  const [y, m] = billForm.period.split('-').map(Number);
  billForm.dueDate = `${y}-${String(m).padStart(2, '0')}-25`;
  billForm.note = '';
  billModal.value = true;
}

async function saveBill() {
  const amount = Math.round(Number(billForm.amountYuan) * 100);
  if (!Number.isFinite(amount) || amount <= 0) return void (billError.value = '金额要大于 0');
  if (!billForm.period) return void (billError.value = '选账期');
  if (!billForm.dueDate) return void (billError.value = '选缴费截止日');

  await bills.create({
    type: billForm.type,
    period: billForm.period,
    amountFen: amount,
    usage: billForm.usage ? Number(billForm.usage) : undefined,
    dueDate: billForm.dueDate,
    note: billForm.note.trim() || undefined,
  });
  selectedMonth.value = billForm.period;
  billModal.value = false;
}

function monthLabel(m: string): string {
  const [y, mm] = m.split('-');
  return `${y} 年 ${Number(mm)} 月`;
}

function shortMonth(m: string): string {
  return `${Number(m.split('-')[1])}月`;
}

/** 简易柱状图：把趋势按最大值归一化 */
const trendMax = computed(() => Math.max(1, ...bills.trend.map((t) => t.amountFen)));
</script>

<template>
  <div class="page">
    <div class="head">
      <h1>账目</h1>
      <button v-if="tab !== 'invoices'" class="primary" type="button" @click="tab === 'fixed' ? openExpense() : openBill()">
        <Plus :size="18" weight="bold" />
        新增
      </button>
    </div>

    <div class="tabs">
      <button :class="{ on: tab === 'fixed' }" @click="tab = 'fixed'">固定支出</button>
      <button :class="{ on: tab === 'bills' }" @click="tab = 'bills'">水电账单</button>
      <button :class="{ on: tab === 'invoices' }" @click="tab = 'invoices'">发票存档</button>
    </div>

    <!-- 固定支出 -->
    <template v-if="tab === 'fixed'">
      <section class="card hero">
        <div>
          <div class="tiny">每月固定支出</div>
          <div class="big num">¥{{ money(fixed.monthlyTotalFen) }}</div>
        </div>
        <div class="divider" />
        <div>
          <div class="tiny">一年下来</div>
          <div class="big num accent">¥{{ money(fixed.annualTotalFen) }}</div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <h2>接下来要扣的</h2>
          <span class="tiny">按时间排序</span>
        </div>
        <ul class="upcoming">
          <li v-for="f in fixed.upcoming" :key="f.id">
            <span class="day-chip" :class="{ soon: f.daysToDue <= 7 }">
              {{ f.daysToDue === 0 ? '今天' : `${f.daysToDue} 天` }}
            </span>
            <span class="li-title">{{ f.name }}</span>
            <span class="num amount">¥{{ money(f.amountFen) }}</span>
          </li>
        </ul>
      </section>

      <section class="list">
        <article v-for="f in fixed.views" :key="f.id" class="card row">
          <div class="row-main">
            <div class="title-row">
              <strong>{{ f.name }}</strong>
              <span class="tag">{{ f.cycle }}</span>
              <span v-if="f.autoPay" class="tag ok">自动扣款</span>
            </div>
            <div class="tiny">
              {{ f.category }} · 下次 {{ f.nextDueDate }} · 折合每月 ¥{{ money(f.monthlyFen) }}
            </div>
          </div>
          <div class="num amount">¥{{ money(f.amountFen) }}</div>
          <div class="ops">
            <button class="icon-btn" type="button" aria-label="编辑" @click="openExpense(f)">
              <Pencil :size="16" />
            </button>
            <button class="icon-btn danger" type="button" aria-label="删除" @click="fixed.remove(f.id)">
              <Trash :size="16" />
            </button>
          </div>
        </article>
        <div v-if="!fixed.views.length" class="card empty">
          <Wallet :size="36" />
          <p>还没有固定支出</p>
          <p class="tiny">房租、物业、宽带、会员，加进来就能看到每月固定压力</p>
        </div>
      </section>

      <section v-if="fixed.next12Months.length" class="card">
        <div class="section-head">
          <h2>未来 12 个月</h2>
          <span class="tiny">单位：元</span>
        </div>
        <div class="chart">
          <div
            v-for="m in fixed.next12Months"
            :key="m.month"
            class="chart-col"
            :title="`${m.month}：¥${money(m.amountFen)}`"
          >
            <div class="bar-wrap">
              <div
                class="bar"
                :style="{
                  height: Math.max(
                    4,
                    Math.round((m.amountFen / Math.max(1, ...fixed.next12Months.map((x) => x.amountFen))) * 100),
                  ) + '%',
                }"
              />
            </div>
            <span class="tiny">{{ shortMonth(m.month) }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- 账单 -->
    <template v-else-if="tab === 'bills'">
      <section class="card hero">
        <div>
          <div class="tiny">本月账单</div>
          <div class="big num">¥{{ money(monthTotal) }}</div>
          <div v-if="momChange !== null" class="tiny" :class="momChange > 0 ? 'up' : 'down'">
            比上月{{ momChange > 0 ? '多' : '少' }} {{ Math.abs(momChange) }}%
          </div>
        </div>
        <div class="divider" />
        <div>
          <div class="tiny">还没缴</div>
          <div class="big num danger">¥{{ money(bills.unpaidFen) }}</div>
          <div class="tiny">今年累计 ¥{{ money(bills.yearTotalFen) }}</div>
        </div>
      </section>

      <div class="month-picker">
        <button
          v-for="m in billMonthOptions.slice(0, 6)"
          :key="m"
          :class="{ on: m === selectedMonth }"
          @click="selectedMonth = m"
        >
          {{ shortMonth(m) }}
        </button>
      </div>

      <section class="list">
        <article v-for="b in monthBills" :key="b.id" class="card row">
          <div class="row-main">
            <div class="title-row">
              <strong>{{ b.type }}</strong>
              <span v-if="b.isPaid" class="tag ok">
                <CheckCircle :size="12" weight="fill" /> 已缴
              </span>
              <span v-else-if="b.overdue" class="tag danger">
                <Clock :size="12" weight="fill" /> 逾期
              </span>
              <span v-else class="tag">待缴</span>
            </div>
            <div class="tiny">
              {{ b.period }} 账期 · 截止 {{ b.dueDate }}
              <template v-if="b.usage">· 用量 {{ b.usage }} {{ b.unit }}</template>
            </div>
          </div>
          <div class="num amount">¥{{ money(b.amountFen) }}</div>
          <div class="ops">
            <button
              class="icon-btn"
              type="button"
              :aria-label="b.isPaid ? '标记未缴' : '标记已缴'"
              @click="b.isPaid ? bills.markUnpaid(b.id) : bills.markPaid(b.id)"
            >
              <CheckCircle :size="16" :weight="b.isPaid ? 'fill' : 'regular'" />
            </button>
            <button class="icon-btn danger" type="button" aria-label="删除" @click="bills.remove(b.id)">
              <Trash :size="16" />
            </button>
          </div>
        </article>
        <div v-if="!monthBills.length" class="card empty">
          <p>{{ monthLabel(selectedMonth) }}还没有账单</p>
          <button class="primary mt" type="button" @click="openBill">
            <Plus :size="16" weight="bold" />
            记一笔
          </button>
        </div>
      </section>

      <section v-if="bills.trend.length > 1" class="card">
        <div class="section-head">
          <h2>近几个月</h2>
          <span class="tiny">水电燃气合计</span>
        </div>
        <div class="chart">
          <div v-for="t in bills.trend" :key="t.period" class="chart-col" :title="`${t.period}：¥${money(t.amountFen)}`">
            <div class="bar-wrap">
              <div class="bar accent" :style="{ height: Math.max(4, Math.round((t.amountFen / trendMax) * 100)) + '%' }" />
            </div>
            <span class="tiny">{{ shortMonth(t.period) }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- 发票 -->
    <InvoicePanel v-else />

    <!-- 固定支出表单 -->
    <div v-if="expenseModal" class="overlay" @click.self="expenseModal = false">
      <div class="sheet">
        <div class="sheet-head">
          <strong>{{ editingExpenseId ? '编辑固定支出' : '新增固定支出' }}</strong>
          <button class="icon-btn" type="button" aria-label="关闭" @click="expenseModal = false">
            <X :size="18" />
          </button>
        </div>
        <label class="field">
          <span>名称</span>
          <input v-model="expenseForm.name" placeholder="房租、宽带、视频会员…" />
        </label>
        <div class="row2">
          <label class="field">
            <span>金额（元）</span>
            <input v-model="expenseForm.amountYuan" type="number" inputmode="decimal" min="0" step="0.01" placeholder="4500" />
          </label>
          <label class="field">
            <span>周期</span>
            <select v-model="expenseForm.cycle">
              <option v-for="c in CYCLES" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
        </div>
        <div class="row2">
          <label class="field">
            <span>扣款日期</span>
            <input v-model="expenseForm.dueDate" type="date" />
          </label>
          <label class="field">
            <span>类别</span>
            <select v-model="expenseForm.category">
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
        </div>
        <label class="check">
          <input v-model="expenseForm.autoPay" type="checkbox" />
          <span>自动扣款（到期不用手动付）</span>
        </label>
        <p v-if="expenseError" class="err">{{ expenseError }}</p>
        <div class="sheet-actions">
          <button class="ghost" type="button" @click="expenseModal = false">取消</button>
          <button class="primary wide" type="button" @click="saveExpense">保存</button>
        </div>
      </div>
    </div>

    <!-- 账单表单 -->
    <div v-if="billModal" class="overlay" @click.self="billModal = false">
      <div class="sheet">
        <div class="sheet-head">
          <strong>记一笔账单</strong>
          <button class="icon-btn" type="button" aria-label="关闭" @click="billModal = false">
            <X :size="18" />
          </button>
        </div>
        <div class="row2">
          <label class="field">
            <span>类型</span>
            <select v-model="billForm.type">
              <option v-for="t in BILL_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
          <label class="field">
            <span>账期</span>
            <input v-model="billForm.period" type="month" />
          </label>
        </div>
        <div class="row2">
          <label class="field">
            <span>金额（元）</span>
            <input v-model="billForm.amountYuan" type="number" inputmode="decimal" min="0" step="0.01" placeholder="238.6" />
          </label>
          <label class="field">
            <span>用量（可选）</span>
            <input v-model="billForm.usage" type="number" inputmode="decimal" min="0" step="0.01" placeholder="341" />
          </label>
        </div>
        <label class="field">
          <span>缴费截止日</span>
          <input v-model="billForm.dueDate" type="date" />
        </label>
        <p v-if="billError" class="err">{{ billError }}</p>
        <div class="sheet-actions">
          <button class="ghost" type="button" @click="billModal = false">取消</button>
          <button class="primary wide" type="button" @click="saveBill">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-md);
  padding-bottom: var(--space-lg);
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

.primary.wide {
  flex: 1;
  justify-content: center;
  min-height: 46px;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 6px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.tabs button {
  flex: 1;
  min-height: 38px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-2);
  font-size: 14px;
  transition: all 0.15s var(--ease-out);
}

.tabs button.on {
  background: var(--glass-bg-strong);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 8px 18px -12px rgba(6, 78, 59, 0.55);
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
  font-size: 22px;
  font-weight: 700;
  margin: 2px 0;
}

.accent {
  color: var(--color-accent);
}

.danger {
  color: var(--color-danger);
}

.up {
  color: var(--color-danger);
}

.down {
  color: var(--color-primary);
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.upcoming li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--color-border);
}

.upcoming li:first-child {
  border-top: none;
}

.day-chip {
  flex: none;
  min-width: 48px;
  text-align: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  color: var(--color-text-2);
  font-size: 12px;
}

.day-chip.soon {
  background: var(--color-accent-weak);
  color: var(--color-accent);
}

.li-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.list {
  display: grid;
  gap: var(--space-sm);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-md);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  color: var(--color-text-2);
}

.tag.ok {
  background: var(--color-primary-weak);
  color: var(--color-primary);
}

.tag.danger {
  background: var(--color-danger-weak);
  color: var(--color-danger);
}

.ops {
  display: flex;
  gap: 4px;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-2);
}

.icon-btn.danger {
  color: var(--color-danger);
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
  margin-top: var(--space-sm);
}

.month-picker {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.month-picker button {
  flex: none;
  min-height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-2);
  font-size: 13px;
}

.month-picker button.on {
  border-color: var(--color-primary);
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 600;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
  padding-top: var(--space-sm);
}

.chart-col {
  flex: 1;
  display: grid;
  justify-items: center;
  gap: 4px;
  height: 100%;
}

.bar-wrap {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 100%;
}

.bar {
  width: 100%;
  border-radius: 6px 6px 2px 2px;
  background: color-mix(in srgb, var(--color-primary) 75%, white);
  min-height: 4px;
}

.bar.accent {
  background: color-mix(in srgb, var(--color-accent) 70%, white);
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(15 23 42 / 45%);
}

.sheet {
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  overflow-y: auto;
  display: grid;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-md) var(--space-lg);
  border-radius: 20px 20px 0 0;
  background: var(--color-card);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.field {
  display: grid;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-2);
}

.field input,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 15px;
  font-family: inherit;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text-2);
}

.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.err {
  color: var(--color-danger);
  font-size: 13px;
  margin: 0;
}

.sheet-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.ghost {
  min-height: 46px;
  padding: 0 20px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-2);
  font-size: 15px;
}

@media (min-width: 640px) {
  .overlay {
    align-items: center;
  }
  .sheet {
    border-radius: 20px;
  }
}
</style>
