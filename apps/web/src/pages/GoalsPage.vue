<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { PhPlus as Plus, PhTrash as Trash, PhPencilSimple as Pencil, PhShieldCheck as Shield, PhPiggyBank as Piggy } from '@phosphor-icons/vue';
import { formatFen, parseYuanToFen } from '@hmm/shared';
import { todayISO } from '@/lib/persist';
import { useSavingGoalsStore } from '@/stores/savingGoals';
import { useInsuranceStore, INSURANCE_KINDS } from '@/stores/insurance';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const goals = useSavingGoalsStore();
const insurance = useInsuranceStore();
const tab = ref<'goals' | 'insurance'>('goals');
const toast = ref('');

onMounted(() => {
  goals.load();
  insurance.load();
  if (auth.isCloud) {
    void goals.hydrateFromCloud();
    void insurance.hydrateFromCloud();
  }
});

function flash(msg: string) {
  toast.value = msg;
  window.setTimeout(() => (toast.value = ''), 2200);
}

const money = (fen: number) => `¥${formatFen(fen)}`;

/* ---------- 目标表单 ---------- */
const goalOpen = ref(false);
const goalEditing = ref<string | null>(null);
const goalForm = reactive({ name: '', target: '', saved: '', targetDate: todayISO() });
const goalError = ref('');

function openGoal(id?: string) {
  goalError.value = '';
  goalEditing.value = id ?? null;
  if (id) {
    const g = goals.items.find((x) => x.id === id);
    if (g) {
      goalForm.name = g.name;
      goalForm.target = (g.targetFen / 100).toString();
      goalForm.saved = (g.savedFen / 100).toString();
      goalForm.targetDate = g.targetDate;
    }
  } else {
    goalForm.name = '';
    goalForm.target = '';
    goalForm.saved = '0';
    goalForm.targetDate = todayISO();
  }
  goalOpen.value = true;
}

async function saveGoal() {
  const targetFen = parseYuanToFen(goalForm.target) ?? 0;
  const savedFen = parseYuanToFen(goalForm.saved) ?? 0;
  if (!goalForm.name.trim()) return (goalError.value = '给这个目标起个名字');
  if (targetFen <= 0) return (goalError.value = '目标金额要大于 0');
  if (!goalForm.targetDate) return (goalError.value = '选一个目标日期');
  const payload = { name: goalForm.name.trim(), targetFen, savedFen, targetDate: goalForm.targetDate };
  if (goalEditing.value) await goals.update(goalEditing.value, payload);
  else await goals.create(payload);
  goalOpen.value = false;
  flash(goalEditing.value ? '目标已更新' : '目标已建立');
}

const depositOpen = ref(false);
const depositId = ref('');
const depositAmount = ref('');

function openDeposit(id: string) {
  depositId.value = id;
  depositAmount.value = '';
  depositOpen.value = true;
}

async function confirmDeposit() {
  const fen = parseYuanToFen(depositAmount.value) ?? 0;
  if (fen <= 0) return;
  await goals.deposit(depositId.value, fen);
  depositOpen.value = false;
  flash('已记入这笔储蓄');
}

/* ---------- 保险表单 ---------- */
const insOpen = ref(false);
const insEditing = ref<string | null>(null);
const insForm = reactive({
  name: '',
  kind: INSURANCE_KINDS[0],
  company: '',
  coverage: '',
  premium: '',
  cycle: '每年',
  startDate: todayISO(),
  endDate: todayISO(),
  contact: '',
  note: '',
});
const insError = ref('');

function openInsurance(id?: string) {
  insError.value = '';
  insEditing.value = id ?? null;
  if (id) {
    const p = insurance.items.find((x) => x.id === id);
    if (p) {
      insForm.name = p.name;
      insForm.kind = p.kind;
      insForm.company = p.company ?? '';
      insForm.coverage = (p.coverageFen / 100).toString();
      insForm.premium = (p.premiumFen / 100).toString();
      insForm.cycle = p.cycle;
      insForm.startDate = p.startDate;
      insForm.endDate = p.endDate;
      insForm.contact = p.contact ?? '';
      insForm.note = p.note ?? '';
    }
  } else {
    insForm.name = '';
    insForm.kind = INSURANCE_KINDS[0];
    insForm.company = '';
    insForm.coverage = '';
    insForm.premium = '';
    insForm.cycle = '每年';
    insForm.startDate = todayISO();
    insForm.endDate = todayISO();
    insForm.contact = '';
    insForm.note = '';
  }
  insOpen.value = true;
}

async function saveInsurance() {
  if (!insForm.name.trim()) return (insError.value = '填一下保单名称');
  if (!insForm.endDate) return (insError.value = '填一下到期日');
  const payload = {
    name: insForm.name.trim(),
    kind: insForm.kind,
    company: insForm.company.trim() || undefined,
    coverageFen: parseYuanToFen(insForm.coverage) ?? 0,
    premiumFen: parseYuanToFen(insForm.premium) ?? 0,
    cycle: insForm.cycle,
    startDate: insForm.startDate,
    endDate: insForm.endDate,
    contact: insForm.contact.trim() || undefined,
    note: insForm.note.trim() || undefined,
  };
  if (insEditing.value) await insurance.update(insEditing.value, payload);
  else await insurance.create(payload);
  insOpen.value = false;
  flash(insEditing.value ? '保单已更新' : '保单已登记');
}

async function removeGoal(id: string) {
  if (!window.confirm('删除这个储蓄目标？')) return;
  await goals.remove(id);
}
async function removeInsurance(id: string) {
  if (!window.confirm('删除这张保单？')) return;
  await insurance.remove(id);
}

const soonestPolicy = computed(() => insurance.views[0]);
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1>目标与保险</h1>
        <p class="muted">把「想买的东西」和「不能出事的东西」都放进来，钱才有去处。</p>
      </div>
      <button class="primary" @click="tab === 'goals' ? openGoal() : openInsurance()">
        <Plus :size="16" weight="bold" /> {{ tab === 'goals' ? '新建目标' : '登记保单' }}
      </button>
    </header>

    <div class="tabs">
      <button :class="{ on: tab === 'goals' }" @click="tab = 'goals'">储蓄目标</button>
      <button :class="{ on: tab === 'insurance' }" @click="tab = 'insurance'">保险台账</button>
    </div>

    <section v-if="tab === 'goals'" class="stack">
      <div class="card hero">
        <div class="hero-item">
          <span class="tiny">已攒 / 目标</span>
          <div class="big num">{{ money(goals.totalSavedFen) }}<span class="slash">/</span>{{ money(goals.totalTargetFen) }}</div>
        </div>
        <div class="divider" />
        <div class="hero-item">
          <span class="tiny">每月要存才能按时达成</span>
          <div class="big num accent">{{ money(goals.monthlyNeedFen) }}</div>
        </div>
      </div>

      <div v-if="!goals.views.length" class="card empty">
        <Piggy :size="28" />
        <p>还没有储蓄目标。先建一个——比如「换车首付」。</p>
        <button class="ghost" @click="openGoal()">建立一个</button>
      </div>

      <article v-for="g in goals.views" :key="g.id" class="card goal">
        <div class="goal-head">
          <div>
            <h3>{{ g.name }}</h3>
            <p class="muted tiny">
              目标日 {{ g.targetDate }} ·
              {{ g.daysLeft >= 0 ? `还有 ${g.daysLeft} 天` : `已过期 ${-g.daysLeft} 天` }} ·
              还差 {{ money(g.remainingFen) }}
            </p>
          </div>
          <div class="goal-ops">
            <button class="ghost small" @click="openDeposit(g.id)">存一笔</button>
            <button class="icon-btn" title="编辑" @click="openGoal(g.id)"><Pencil :size="15" /></button>
            <button class="icon-btn" title="删除" @click="removeGoal(g.id)"><Trash :size="15" /></button>
          </div>
        </div>
        <div class="bar"><i :style="{ width: g.percent + '%' }" /></div>
        <div class="goal-foot tiny">
          <span class="num">{{ money(g.savedFen) }} / {{ money(g.targetFen) }}</span>
          <span>{{ g.done ? '已达成 🎉' : `每月约存 ${money(g.monthlyNeedFen)}` }}</span>
        </div>
      </article>
    </section>

    <section v-else class="stack">
      <div class="card hero">
        <div class="hero-item">
          <span class="tiny">总保额</span>
          <div class="big num">{{ money(insurance.totalCoverageFen) }}</div>
        </div>
        <div class="divider" />
        <div class="hero-item">
          <span class="tiny">年保费合计</span>
          <div class="big num accent">{{ money(insurance.annualPremiumFen) }}</div>
        </div>
      </div>

      <div v-if="soonestPolicy" class="card hint">
        <Shield :size="18" />
        <span>最近到期：<strong>{{ soonestPolicy.name }}</strong> · {{ soonestPolicy.endDate }}（{{ soonestPolicy.daysToEnd >= 0 ? `还有 ${soonestPolicy.daysToEnd} 天` : `已过期 ${-soonestPolicy.daysToEnd} 天` }}）</span>
      </div>

      <div v-if="!insurance.views.length" class="card empty">
        <Shield :size="28" />
        <p>还没有登记保单。家财险、车险、医疗险都可以放进来。</p>
        <button class="ghost" @click="openInsurance()">登记一张</button>
      </div>

      <article v-for="p in insurance.views" :key="p.id" class="card policy">
        <div class="policy-head">
          <div>
            <h3>{{ p.name }} <span class="chip">{{ p.kind }}</span></h3>
            <p class="muted tiny">
              {{ p.company || '未填保险公司' }} · {{ p.cycle }} {{ money(p.premiumFen) }} · 保障 {{ money(p.coverageFen) }}
            </p>
          </div>
          <div class="goal-ops">
            <span class="days" :class="{ bad: p.daysToEnd < 0, warn: p.daysToEnd >= 0 && p.daysToEnd <= 30 }">
              {{ p.daysToEnd >= 0 ? `${p.daysToEnd} 天后到期` : `已过期 ${-p.daysToEnd} 天` }}
            </span>
            <button class="icon-btn" title="编辑" @click="openInsurance(p.id)"><Pencil :size="15" /></button>
            <button class="icon-btn" title="删除" @click="removeInsurance(p.id)"><Trash :size="15" /></button>
          </div>
        </div>
        <p class="tiny muted">{{ p.startDate }} → {{ p.endDate }}<span v-if="p.contact"> · {{ p.contact }}</span></p>
        <p v-if="p.note" class="tiny muted">{{ p.note }}</p>
      </article>
    </section>

    <!-- 目标弹层 -->
    <div v-if="goalOpen" class="overlay" @click.self="goalOpen = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>{{ goalEditing ? '编辑目标' : '新建储蓄目标' }}</h3>
          <button class="icon-btn" @click="goalOpen = false">✕</button>
        </div>
        <label class="field"><span>叫什么</span><input v-model="goalForm.name" placeholder="换车首付" /></label>
        <div class="row2">
          <label class="field"><span>目标金额（元）</span><input v-model="goalForm.target" inputmode="decimal" placeholder="80000" /></label>
          <label class="field"><span>已经攒了（元）</span><input v-model="goalForm.saved" inputmode="decimal" placeholder="0" /></label>
        </div>
        <label class="field"><span>想什么时候达成</span><input v-model="goalForm.targetDate" type="date" /></label>
        <p v-if="goalError" class="err">{{ goalError }}</p>
        <div class="sheet-actions">
          <button class="ghost" @click="goalOpen = false">取消</button>
          <button class="primary" @click="saveGoal">保存</button>
        </div>
      </div>
    </div>

    <!-- 存一笔 -->
    <div v-if="depositOpen" class="overlay" @click.self="depositOpen = false">
      <div class="sheet">
        <div class="sheet-head"><h3>存一笔</h3><button class="icon-btn" @click="depositOpen = false">✕</button></div>
        <label class="field"><span>金额（元）</span><input v-model="depositAmount" inputmode="decimal" placeholder="2000" /></label>
        <div class="sheet-actions">
          <button class="ghost" @click="depositOpen = false">取消</button>
          <button class="primary" @click="confirmDeposit">记上</button>
        </div>
      </div>
    </div>

    <!-- 保单弹层 -->
    <div v-if="insOpen" class="overlay" @click.self="insOpen = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>{{ insEditing ? '编辑保单' : '登记保单' }}</h3>
          <button class="icon-btn" @click="insOpen = false">✕</button>
        </div>
        <label class="field"><span>保单名称</span><input v-model="insForm.name" placeholder="家庭财产险" /></label>
        <div class="row2">
          <label class="field">
            <span>险种</span>
            <select v-model="insForm.kind"><option v-for="k in INSURANCE_KINDS" :key="k">{{ k }}</option></select>
          </label>
          <label class="field"><span>保险公司</span><input v-model="insForm.company" placeholder="中国人保" /></label>
        </div>
        <div class="row2">
          <label class="field"><span>保额（元）</span><input v-model="insForm.coverage" inputmode="decimal" placeholder="1000000" /></label>
          <label class="field"><span>保费（元）</span><input v-model="insForm.premium" inputmode="decimal" placeholder="680" /></label>
        </div>
        <div class="row2">
          <label class="field"><span>缴费周期</span>
            <select v-model="insForm.cycle"><option>每月</option><option>每季</option><option>每半年</option><option>每年</option><option>一次性</option></select>
          </label>
          <label class="field"><span>联系电话</span><input v-model="insForm.contact" placeholder="95518" /></label>
        </div>
        <div class="row2">
          <label class="field"><span>起保日</span><input v-model="insForm.startDate" type="date" /></label>
          <label class="field"><span>到期日</span><input v-model="insForm.endDate" type="date" /></label>
        </div>
        <label class="field"><span>备注</span><input v-model="insForm.note" placeholder="保单号、理赔电话…" /></label>
        <p v-if="insError" class="err">{{ insError }}</p>
        <div class="sheet-actions">
          <button class="ghost" @click="insOpen = false">取消</button>
          <button class="primary" @click="saveInsurance">保存</button>
        </div>
      </div>
    </div>

    <transition name="fade"><div v-if="toast" class="toast">{{ toast }}</div></transition>
  </div>
</template>

<style scoped>
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); margin-bottom: var(--space-lg); }
.page-head h1 { margin: 0 0 4px; font-size: 24px; }
.page-head p { margin: 0; }
.tabs { display: flex; gap: 6px; padding: 4px; border-radius: var(--radius-pill); background: var(--glass-bg-soft); width: fit-content; margin-bottom: var(--space-lg); box-shadow: var(--shadow-inset); }
.tabs button { border: none; background: transparent; font: inherit; color: var(--color-text-2); padding: 7px 16px; border-radius: var(--radius-pill); cursor: pointer; }
.tabs button.on { color: var(--color-text); background: var(--glass-bg-strong); box-shadow: var(--shadow-card); font-weight: 600; }
.stack { display: grid; gap: var(--space-md); }
.hero { display: flex; gap: var(--space-lg); align-items: center; }
.hero-item { flex: 1; min-width: 0; }
.divider { width: 1px; align-self: stretch; background: var(--color-border); }
.big { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin-top: 4px; }
.big.accent { background: var(--grad-accent); -webkit-background-clip: text; background-clip: text; color: transparent; }
.slash { opacity: .35; margin: 0 4px; font-weight: 400; }
.empty { text-align: center; padding: var(--space-xl); color: var(--color-text-2); }
.empty p { margin: 10px 0 14px; }
.goal-head, .policy-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-md); }
.goal h3, .policy h3 { margin: 0 0 2px; font-size: 16px; }
.goal-ops { display: flex; align-items: center; gap: 6px; }
.bar { height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--color-text-3) 14%, transparent); margin: 14px 0 8px; overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 999px; background: var(--grad-primary); }
.goal-foot { display: flex; justify-content: space-between; color: var(--color-text-2); }
.hint { display: flex; align-items: center; gap: 10px; color: var(--color-text-2); }
.chip { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); margin-left: 6px; }
.days { font-size: 12px; color: var(--color-text-2); }
.days.warn { color: var(--color-accent); font-weight: 600; }
.days.bad { color: var(--color-danger); font-weight: 600; }
.icon-btn { border: none; background: transparent; color: var(--color-text-3); cursor: pointer; padding: 6px; border-radius: 8px; }
.icon-btn:hover { background: var(--color-primary-weak); color: var(--color-text); }
.ghost.small { padding: 5px 12px; font-size: 12px; white-space: nowrap; flex: none; }
.field { display: grid; gap: 5px; margin-bottom: 12px; font-size: 12px; color: var(--color-text-2); }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.err { color: var(--color-danger); font-size: 12px; margin: 0 0 8px; }
.toast { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); background: var(--color-text); color: var(--color-card); padding: 8px 16px; border-radius: 999px; font-size: 13px; z-index: 60; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 560px) {
  .page-head { flex-direction: column; }
  .goal-head, .policy-head { flex-wrap: wrap; }
  .goal-ops { width: 100%; justify-content: flex-end; }
  .hero { flex-direction: column; align-items: stretch; }
  .divider { width: 100%; height: 1px; }
}
</style>
