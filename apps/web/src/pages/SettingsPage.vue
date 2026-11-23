<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  PhSun as Sun,
  PhMoon as Moon,
  PhUsers as Users,
  PhDownloadSimple as DownloadSimple,
  PhBell as Bell,
  PhSignOut as SignOut,
} from '@phosphor-icons/vue';

const theme = ref<'light' | 'dark'>('light');
const health = ref<'checking' | 'ok' | 'fail'>('checking');

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

async function ping() {
  try {
    const res = await fetch('/api/v1/health');
    health.value = res.ok ? 'ok' : 'fail';
  } catch {
    health.value = 'fail';
  }
}

const healthText = { checking: '检测中…', ok: 'API 正常', fail: 'API 未连接' };
</script>

<template>
  <div class="page">
    <h1>我的</h1>

    <section class="card profile">
      <div class="avatar">我</div>
      <div>
        <div class="name">演示用户</div>
        <div class="tiny">我的家 · 户主</div>
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
        <span class="tiny">M2 开放</span>
      </button>
      <button class="row" type="button" disabled>
        <Bell :size="18" />
        <span>提醒设置</span>
        <span class="tiny">M4 开放</span>
      </button>
      <button class="row" type="button" disabled>
        <DownloadSimple :size="18" />
        <span>导出数据</span>
        <span class="tiny">M5 开放</span>
      </button>
      <button class="row danger" type="button" disabled>
        <SignOut :size="18" />
        <span>退出登录</span>
        <span class="tiny">M2 开放</span>
      </button>
    </section>

    <p class="tiny center">HMM v0.1.0 · M1 骨架</p>
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
  background: var(--color-danger-weak);
  color: var(--color-danger);
}

.card {
  padding: 0 var(--space-md);
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
</style>
