<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterView } from 'vue-router';
import {
  PhHouse as HouseIcon,
  PhArmchair as Armchair,
  PhCalendarDots as CalendarDots,
  PhReceipt as Receipt,
  PhUserCircle as UserCircle,
} from '@phosphor-icons/vue';

const route = useRoute();

const tabs = [
  { path: '/', label: '首页', icon: HouseIcon },
  { path: '/assets', label: '资产', icon: Armchair },
  { path: '/calendar', label: '日历', icon: CalendarDots },
  { path: '/receipts', label: '账目', icon: Receipt },
  { path: '/settings', label: '我的', icon: UserCircle },
];

const current = computed(() => route.path);
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
      <div class="family-chip">
        <span class="dot" />
        我的家
      </div>
    </header>

    <main class="content">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>

    <nav class="tabbar" aria-label="主导航">
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
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
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
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  flex: none;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.family-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
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
  background: color-mix(in srgb, var(--color-card) 92%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--color-border);
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

.tab.active {
  color: var(--color-primary);
  font-weight: 600;
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
    border-right: 1px solid var(--color-border);
    padding-top: 88px;
  }
  .content {
    margin-left: 88px;
    padding: var(--space-lg);
  }
  .topbar {
    padding-left: calc(88px + var(--space-lg));
  }
}
</style>
