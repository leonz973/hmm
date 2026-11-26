<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  PhSun as Sun,
  PhMoon as Moon,
  PhUsers as Users,
  PhDownloadSimple as DownloadSimple,
  PhUploadSimple as UploadSimple,
  PhBell as Bell,
  PhSignOut as SignOut,
  PhTrash as Trash,
  PhFileCsv as FileCsv,
  PhCloudArrowUp as CloudIcon,
  PhCopy as Copy,
} from '@phosphor-icons/vue';
import { api } from '@/lib/api';
import { clearAll, exportAssetsCSV, exportJSON, importJSON } from '@/lib/backup';
import { useAuthStore } from '@/stores/auth';
import { useAssetsStore } from '@/stores/assets';
import { useFixedExpensesStore } from '@/stores/fixedExpenses';
import { useBillsStore } from '@/stores/bills';
import { useInvoicesStore } from '@/stores/invoices';
import {
  REPLACE_LEAD_OPTIONS,
  WARRANTY_LEAD_OPTIONS,
  usePrefsStore,
} from '@/stores/prefs';

const prefs = usePrefsStore();
const auth = useAuthStore();
const assets = useAssetsStore();
const fixedStore = useFixedExpensesStore();
const billsStore = useBillsStore();
const invoicesStore = useInvoicesStore();
const router = useRouter();
const remindModal = ref(false);
const familyModal = ref(false);
const inviteCode = ref('');
const joinCode = ref('');
const familyBusy = ref(false);
const familyError = ref('');
const notifyEmail = ref(true);
const remindBusy = ref(false);
const smtpReady = ref(true);

const accountName = computed(() => auth.user?.displayName ?? '我的家');
const accountSub = computed(() =>
  auth.isCloud
    ? `${auth.user?.email ?? ''} · ${auth.household?.name ?? ''}`
    : '本地模式：数据存在这台设备的浏览器里',
);
const memberCount = computed(() => auth.household?.members.length ?? 0);

const theme = ref<'light' | 'dark'>('light');
const health = ref<'checking' | 'ok' | 'fail'>('checking');
const toast = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  theme.value = (localStorage.getItem('hmm-theme') as 'light' | 'dark') ?? 'light';
  apply();
  prefs.load();
  void ping();
  void loadServerReminders();
});

/** 云端模式下把服务端的提醒设置拉回来（首页/日历与邮件口径一致） */
async function loadServerReminders() {
  if (!auth.isCloud) return;
  try {
    const data = await api.listReminders<unknown>();
    prefs.setWarrantyLead(data.warrantyLeadDays);
    prefs.setReplaceLead(data.replaceLeadDays);
    notifyEmail.value = data.notifyEmail;
    smtpReady.value = data.smtpConfigured;
  } catch {
    /* 拉不到就用本地设置，不打扰用户 */
  }
}

/** 改提醒设置：本地立刻生效，登录后同步到服务器（服务器决定邮件） */
async function saveRemind() {
  if (!auth.isCloud) {
    flash('已保存（本地模式，不会发邮件）');
    return;
  }
  remindBusy.value = true;
  try {
    await api.updateHouseholdSettings({
      warrantyLeadDays: prefs.warrantyLeadDays,
      replaceLeadDays: prefs.replaceLeadDays,
      notifyEmail: notifyEmail.value,
    });
    flash('提醒设置已同步到服务器');
  } catch (e) {
    flash((e as Error).message || '同步失败');
  } finally {
    remindBusy.value = false;
  }
}

/** 立刻跑一次提醒（dryRun=false 才会真的发邮件） */
async function sendTestReminder() {
  if (!auth.isCloud) {
    flash('登录并配置服务器邮箱后才能发邮件');
    return;
  }
  remindBusy.value = true;
  try {
    const r = await api.runReminders(false);
    if (r.sent > 0) flash(`已发送 ${r.sent} 封提醒邮件`);
    else if (r.status === 'skipped') flash(`未发送：${r.message ?? '邮件未配置'}`);
    else flash('当前没有需要提醒的事项');
  } catch (e) {
    flash((e as Error).message || '发送失败');
  } finally {
    remindBusy.value = false;
  }
}

function apply() {
  document.documentElement.dataset.theme = theme.value;
  localStorage.setItem('hmm-theme', theme.value);
}

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  apply();
}

function flash(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2600);
}

async function ping() {
  try {
    const res = await fetch('/api/v1/health');
    health.value = res.ok ? 'ok' : 'fail';
  } catch {
    health.value = 'fail';
  }
}

const healthText = { checking: '检测中…', ok: 'API 正常', fail: '连接失败' };

async function createInvite() {
  familyBusy.value = true;
  familyError.value = '';
  try {
    const res = await auth.invite();
    inviteCode.value = res.code;
  } catch (e) {
    familyError.value = e instanceof Error ? e.message : '生成邀请码失败';
  } finally {
    familyBusy.value = false;
  }
}

async function copyInvite() {
  if (!inviteCode.value) return;
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    flash('邀请码已复制，发给家人即可');
  } catch {
    flash(`邀请码：${inviteCode.value}`);
  }
}

async function joinFamily() {
  const code = joinCode.value.trim();
  if (!code) return;
  familyBusy.value = true;
  familyError.value = '';
  try {
    const res = await auth.join(code);
    joinCode.value = '';
    await assets.hydrateFromCloud();
    flash(res.already ? '你已经在这个家里了' : `已加入「${res.name}」`);
  } catch (e) {
    familyError.value = e instanceof Error ? e.message : '加入失败';
  } finally {
    familyBusy.value = false;
  }
}

async function doLogout() {
  if (!confirm('退出登录？退出后这台设备回到本地模式，云端数据不会丢。')) return;
  await auth.logout();
  // 整页重载：否则内存里还留着云端那几块数据
  location.assign('/');
}

function onExportJSON() {
  exportJSON();
  flash('已导出 JSON 备份');
}

function onExportCSV() {
  exportAssetsCSV();
  flash('已导出资产清单 CSV');
}

function pickFile() {
  fileInput.value?.click();
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  const result = await importJSON(text, 'merge');
  if (auth.isCloud && result.ok) {
    await Promise.all([
      assets.hydrateFromCloud(),
      fixedStore.hydrateFromCloud(),
      billsStore.hydrateFromCloud(),
      invoicesStore.hydrateFromCloud(),
    ]);
  }
  flash(result.message);
  input.value = '';
}

function onClear() {
  if (!confirm('清空本机所有数据（资产、固定支出、账单、发票）？此操作无法撤销，建议先导出备份。')) return;
  clearAll();
  flash('已清空，刷新页面生效');
  setTimeout(() => location.reload(), 800);
}
</script>

<template>
  <div class="page">
    <h1>我的</h1>

    <section class="card profile">
      <div class="avatar">{{ accountName.slice(0, 1) }}</div>
      <div class="who">
        <div class="name">{{ accountName }}</div>
        <div class="tiny">{{ accountSub }}</div>
      </div>
      <span class="status" :class="health">{{ healthText[health] }}</span>
    </section>

    <section v-if="!auth.isCloud" class="card cloud-cta">
      <div class="cta-text">
        <strong>开启云同步</strong>
        <p class="tiny">登录后数据存到服务器，家人在手机上也能看到同一份账。</p>
      </div>
      <button class="mini primary" type="button" @click="router.push('/login')">
        <CloudIcon :size="16" />
        登录 / 注册
      </button>
    </section>

    <section class="card">
      <button class="row" type="button" @click="toggleTheme">
        <component :is="theme === 'light' ? Sun : Moon" :size="18" />
        <span>外观</span>
        <span class="tiny">{{ theme === 'light' ? '浅色' : '深色' }}</span>
      </button>
      <button class="row" type="button" @click="familyModal = true">
        <Users :size="18" />
        <span>家庭成员</span>
        <span class="tiny">
          {{ auth.isCloud ? `${memberCount} 人 · 邀请码` : '登录后可用' }}
        </span>
      </button>
      <button class="row" type="button" @click="remindModal = true">
        <Bell :size="18" />
        <span>提醒设置</span>
        <span class="tiny">质保提前 {{ prefs.warrantyLeadDays }} 天 · 换新提前 {{ prefs.replaceLeadDays }} 天</span>
      </button>
    </section>

    <section class="card data-card">
      <div class="section-title">
        <DownloadSimple :size="18" />
        <span>数据</span>
      </div>
      <p v-if="auth.isCloud" class="tiny desc">
        当前是云同步模式：导出的是服务器上的这份数据；导入会写进当前家庭。
      </p>
      <p v-else class="tiny desc">换个浏览器、换台电脑，数据不会自己跟过去。定期导出备份，相当于给自己留个后路。</p>
      <div class="btn-row">
        <button class="mini" type="button" @click="onExportJSON">
          <DownloadSimple :size="16" />
          导出全部（JSON）
        </button>
        <button class="mini" type="button" @click="onExportCSV">
          <FileCsv :size="16" />
          资产清单（CSV）
        </button>
      </div>
      <div class="btn-row">
        <button class="mini" type="button" @click="pickFile">
          <UploadSimple :size="16" />
          导入备份
        </button>
        <button v-if="!auth.isCloud" class="mini danger" type="button" @click="onClear">
          <Trash :size="16" />
          清空数据
        </button>
        <span v-else class="tiny">云端数据存在服务器上，这里不提供一键清空；要删请在资产/账目页逐条删除。</span>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFile" />
    </section>

    <section class="card">
      <button class="row danger" type="button" :disabled="!auth.isCloud" @click="doLogout">
        <SignOut :size="18" />
        <span>退出登录</span>
        <span class="tiny">{{ auth.isCloud ? auth.user?.email : '当前未登录' }}</span>
      </button>
    </section>

    <p class="tiny center">HMM v0.1.0 · 本地可用版</p>

    <div v-if="familyModal" class="overlay" @click.self="familyModal = false">
      <div class="sheet">
        <div class="sheet-head">
          <strong>家庭成员</strong>
          <button class="mini" type="button" @click="familyModal = false">关闭</button>
        </div>

        <template v-if="auth.isCloud">
          <p class="tiny desc">「{{ auth.household?.name }}」共 {{ memberCount }} 人。同一个家的人看到同一份资产和账单，谁都能编辑。</p>
          <ul class="members">
            <li v-for="m in auth.household?.members" :key="m.userId">
              <span class="avatar sm">{{ m.displayName.slice(0, 1) }}</span>
              <span class="m-name">{{ m.displayName }}</span>
              <span class="tiny">{{ m.role === 'owner' ? '户主' : m.role === 'admin' ? '管理' : '成员' }}</span>
            </li>
          </ul>

          <div class="invite-box">
            <div class="tiny">邀请家人（72 小时有效）</div>
            <div class="invite-row">
              <code>{{ inviteCode || '还没有生成' }}</code>
              <button class="mini" type="button" :disabled="familyBusy" @click="createInvite">
                {{ inviteCode ? '重新生成' : '生成邀请码' }}
              </button>
              <button v-if="inviteCode" class="mini" type="button" @click="copyInvite">
                <Copy :size="14" />
                复制
              </button>
            </div>
          </div>

          <label class="field">
            <span>加入别人的家？输入邀请码</span>
            <div class="join-row">
              <input v-model="joinCode" type="text" placeholder="8 位邀请码" maxlength="8" />
              <button class="mini primary" type="button" :disabled="familyBusy" @click="joinFamily">加入</button>
            </div>
          </label>

          <p v-if="familyError" class="err">{{ familyError }}</p>
        </template>

        <template v-else>
          <p class="tiny desc">本地模式下没有家庭成员。登录后可以邀请家人加入同一个家庭空间。</p>
          <button class="mini primary" type="button" @click="familyModal = false; router.push('/login')">
            去登录
          </button>
        </template>
      </div>
    </div>

    <div v-if="remindModal" class="overlay" @click.self="remindModal = false">
      <div class="sheet">
        <div class="sheet-head">
          <strong>提醒设置</strong>
          <button class="mini" type="button" @click="remindModal = false">完成</button>
        </div>
        <p class="tiny desc">决定首页和日历从多久之前开始提醒你。提前越多，准备资金的时间越充裕。</p>

        <label class="field">
          <span>质保到期提前</span>
          <select
            :value="prefs.warrantyLeadDays"
            @change="prefs.setWarrantyLead(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="d in WARRANTY_LEAD_OPTIONS" :key="d" :value="d">{{ d }} 天</option>
          </select>
        </label>

        <label class="field">
          <span>预计换新提前</span>
          <select
            :value="prefs.replaceLeadDays"
            @change="prefs.setReplaceLead(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="d in REPLACE_LEAD_OPTIONS" :key="d" :value="d">{{ d }} 天</option>
          </select>
        </label>

        <label v-if="auth.isCloud" class="field switch-field">
          <span>邮件提醒</span>
          <input v-model="notifyEmail" type="checkbox" />
        </label>

        <p class="tiny">当前：{{ prefs.warrantyLeadDays }} 天 / {{ prefs.replaceLeadDays }} 天，改动即时生效。</p>
        <p v-if="auth.isCloud && !smtpReady" class="tiny desc warn">
          服务器还没配置发信邮箱（SMTP），现在只会记录提醒、不会真的发信。
        </p>
        <p v-if="!auth.isCloud" class="tiny desc">
          本地模式不会发邮件。登录后可在服务器配置邮箱，由服务器每天 06:00 检查一次。
        </p>

        <div class="sheet-actions">
          <button class="ghost" type="button" :disabled="remindBusy" @click="sendTestReminder">
            测试提醒
          </button>
          <button class="primary" type="button" :disabled="remindBusy" @click="saveRemind">
            保存
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 0.42);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  z-index: 40;
}

.sheet {
  width: 100%;
  max-width: 480px;
  background: var(--color-card);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  padding: var(--space-lg);
  display: grid;
  gap: var(--space-md);
}

.sheet-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 4px;
}

.sheet-actions button {
  padding: 9px 16px;
  border-radius: var(--radius-control);
  font-size: 14px;
  border: 1px solid transparent;
  cursor: pointer;
}

.sheet-actions .ghost {
  background: transparent;
  border-color: var(--color-border, #e2e8e0);
  color: var(--color-text);
}

.sheet-actions .primary {
  background: var(--color-primary);
  color: #fff;
}

.sheet-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.warn {
  color: var(--color-accent);
}

.switch-field {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.switch-field input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.members {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.members li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.m-name {
  flex: 1;
  font-size: 14px;
}

.avatar.sm {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.invite-box {
  display: grid;
  gap: 6px;
}

.invite-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.invite-row code {
  flex: 1;
  padding: 8px 10px;
  border-radius: var(--radius-control);
  background: var(--color-bg);
  letter-spacing: 2px;
  font-weight: 600;
}

.join-row {
  display: flex;
  gap: 8px;
}

.join-row input {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 9px 10px;
  font-size: 14px;
}

.err {
  margin: 0;
  font-size: 13px;
  color: #b91c1c;
}

.cloud-cta {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  justify-content: space-between;
}

.cta-text p {
  margin: 2px 0 0;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.field select {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-card);
  color: var(--color-text);
  font: inherit;
}

@media (min-width: 640px) {
  .overlay {
    align-items: center;
    padding: var(--space-lg);
  }

  .sheet {
    border-radius: var(--radius-card);
  }
}

.page {
  display: grid;
  gap: var(--space-md);
}

h1 {
  font-size: 20px;
  font-weight: 600;
}

.profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 600;
  font-size: 18px;
}

.name {
  font-weight: 600;
}

.status {
  margin-left: auto;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  color: var(--color-text-3);
}

.status.ok {
  background: var(--color-primary-weak);
  color: var(--color-primary);
}

.status.fail {
  background: var(--color-accent-weak);
  color: var(--color-accent);
}

.card {
  padding: 0 var(--space-md);
}

.data-card {
  padding: var(--space-md);
  display: grid;
  gap: var(--space-sm);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.desc {
  margin: 0;
  line-height: 1.5;
}

.btn-row {
  display: flex;
  gap: 8px;
}

.mini {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 13px;
}

.mini:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.mini.danger {
  color: var(--color-danger);
}

.mini.danger:hover {
  border-color: var(--color-danger);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 0;
  border: none;
  border-top: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  text-align: left;
}

.row:first-child {
  border-top: none;
}

.row span:nth-of-type(1) {
  flex: 1;
}

.row:disabled {
  color: var(--color-text-3);
  cursor: not-allowed;
}

.row.danger:not(:disabled) {
  color: var(--color-danger);
}

.center {
  text-align: center;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: rgb(15 23 42 / 88%);
  color: #fff;
  font-size: 13px;
  z-index: 60;
}
</style>
