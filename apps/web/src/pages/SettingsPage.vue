<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
} from '@phosphor-icons/vue';
import { clearAll, exportAssetsCSV, exportJSON, importJSON } from '@/lib/backup';

const theme = ref<'light' | 'dark'>('light');
const health = ref<'checking' | 'ok' | 'fail'>('checking');
const toast = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  theme.value = (localStorage.getItem('hmm-theme') as 'light' | 'dark') ?? 'light';
  apply();
  void ping();
});

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

const healthText = { checking: '检测中…', ok: 'API 正常', fail: '本地模式' };

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
  const result = importJSON(text, 'merge');
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
      <div class="avatar">我</div>
      <div>
        <div class="name">我的家</div>
        <div class="tiny">数据存在这台设备的浏览器里</div>
      </div>
      <span class="status" :class="health">{{ healthText[health] }}</span>
    </section>

    <section class="card">
      <button class="row" type="button" @click="toggleTheme">
        <component :is="theme === 'light' ? Sun : Moon" :size="18" />
        <span>外观</span>
        <span class="tiny">{{ theme === 'light' ? '浅色' : '深色' }}</span>
      </button>
      <button class="row" type="button" disabled>
        <Users :size="18" />
        <span>家庭成员</span>
        <span class="tiny">需登录后开放</span>
      </button>
      <button class="row" type="button" disabled>
        <Bell :size="18" />
        <span>提醒设置</span>
        <span class="tiny">需登录后开放</span>
      </button>
    </section>

    <section class="card data-card">
      <div class="section-title">
        <DownloadSimple :size="18" />
        <span>数据</span>
      </div>
      <p class="tiny desc">换个浏览器、换台电脑，数据不会自己跟过去。定期导出备份，相当于给自己留个后路。</p>
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
        <button class="mini danger" type="button" @click="onClear">
          <Trash :size="16" />
          清空数据
        </button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFile" />
    </section>

    <section class="card">
      <button class="row danger" type="button" disabled>
        <SignOut :size="18" />
        <span>退出登录</span>
        <span class="tiny">需登录后开放</span>
      </button>
    </section>

    <p class="tiny center">HMM v0.1.0 · 本地可用版</p>

    <div v-if="toast" class="toast">{{ toast }}</div>
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
