import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './styles/tokens.css';
import DashboardPage from './pages/DashboardPage.vue';
import AssetsPage from './pages/AssetsPage.vue';
import CalendarPage from './pages/CalendarPage.vue';
import LedgerPage from './pages/LedgerPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import AssetFormPage from './pages/AssetFormPage.vue';
import LoginPage from './pages/LoginPage.vue';
import { useAuthStore } from './stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardPage, meta: { title: '首页' } },
    { path: '/assets', name: 'assets', component: AssetsPage, meta: { title: '资产' } },
    { path: '/assets/new', name: 'asset-new', component: AssetFormPage, meta: { title: '录入资产' } },
    {
      path: '/assets/:id/edit',
      name: 'asset-edit',
      component: AssetFormPage,
      meta: { title: '编辑资产' },
    },
    { path: '/calendar', name: 'calendar', component: CalendarPage, meta: { title: '日历' } },
    { path: '/receipts', name: 'receipts', component: LedgerPage, meta: { title: '账目' } },
    { path: '/settings', name: 'settings', component: SettingsPage, meta: { title: '我的' } },
    { path: '/login', name: 'login', component: LoginPage, meta: { title: '登录' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router);

// 先恢复登录态再挂载：否则首屏会在「本地模式」和「云同步」之间闪一下
void useAuthStore(pinia)
  .init()
  .finally(() => app.mount('#app'));
