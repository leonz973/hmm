<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter, RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { initInstallPrompt } from '@/lib/install';
import {
  PhHouse as HouseIcon,
  PhArmchair as Armchair,
  PhCalendarDots as CalendarDots,
  PhReceipt as Receipt,
  PhUserCircle as UserCircle,
} from '@phosphor-icons/vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const showTabs = computed(() => route.name !== 'login');

const accountLabel = computed(() => {
  if (!auth.isCloud) return '本地模式';
  return auth.household?.name ?? '我的家';
});

function onAccountClick() {
  void router.push(auth.isCloud ? '/settings' : '/login');
}

const tabs = [
  { path: '/', label: '首页', icon: HouseIcon },
  { path: '/assets', label: '资产', icon: Armchair },
  { path: '/calendar', label: '日历', icon: CalendarDots },
  { path: '/receipts', label: '账目', icon: Receipt },
  { path: '/settings', label: '我的', icon: UserCircle },
];

const current = computed(() => route.path);

initInstallPrompt();
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo">H</span>
        <div>
          <div class="brand-name">HMM 家庭资产管家</div>
          <div class="tiny">把家当记清楚 · 管明白 · 换得从容</div>
        </div>
      </div>
      <button class="family-chip" type="button" @click="onAccountClick">
        <span class="dot" :class="{ cloud: auth.isCloud }" />
        {{ accountLabel }}
      </button>
    </header>

    <div v-if="!auth.isCloud && route.name !== 'login'" class="local-hint">
      <span>本地模式：数据只存在这台设备</span>
      <button type="button" @click="router.push('/login')">开启云同步</button>
    </div>

    <main class="content">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>

    <nav v-if="showTabs" class="tabbar" aria-label="主导航">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab"
        :class="{ active: current === tab.path }"
      >
        <component :is="tab.icon" :size="22" weight="regular" />
        <span>{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.local-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #92500e;
  background: rgba(251, 191, 36, 0.16);
  border: 1px solid rgba(251, 191, 36, 0.42);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-pill);
  width: fit-content;
  margin: var(--space-sm) var(--space-md) 0;
  padding: 7px 14px;
}

.local-hint button {
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: 12px var(--space-md);
  padding-top: max(12px, env(safe-area-inset-top));
  background: var(--glass-bg-soft);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-bottom: 1px solid var(--glass-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background-image: var(--grad-primary);
  color: #042b1f;
  box-shadow: var(--shadow-glow);
  font-weight: 700;
  font-size: 18px;
  flex: none;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  background: var(--grad-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.family-chip {
  border: 0;
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-inset);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.dot.cloud {
  background: var(--color-primary);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
}

.content {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-md);
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
}

.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-top: 1px solid var(--glass-border);
  box-shadow: 0 -12px 30px -24px rgba(6, 78, 59, 0.5);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  font-size: 11px;
  color: var(--color-text-3);
  text-decoration: none;
  transition: color 0.15s var(--ease-out);
}

.tab {
  position: relative;
}

.tab.active {
  color: var(--color-primary);
  font-weight: 600;
}

.tab.active::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 54px;
  height: 34px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  z-index: -1;
}

.tab:active {
  transform: scale(0.97);
}

@media (min-width: 900px) {
  .tabbar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: auto;
    width: 88px;
    grid-template-columns: 1fr;
    grid-auto-rows: 72px;
    border-top: none;
    border-right: 1px solid var(--glass-border);
    background: var(--glass-bg-soft);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    box-shadow: 1px 0 0 rgba(6, 78, 59, 0.04);
    padding-top: 88px;
  }
  .content {
    margin-left: 88px;
    padding: var(--space-lg);
    padding-bottom: var(--space-xl);
  }
  .topbar {
    padding-left: calc(88px + var(--space-lg));
  }
  .local-hint {
    margin-left: calc(88px + var(--space-lg));
    margin-right: var(--space-lg);
  }
}
</style>
