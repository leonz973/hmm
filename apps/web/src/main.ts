import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './styles/tokens.css';
import DashboardPage from './pages/DashboardPage.vue';
import AssetsPage from './pages/AssetsPage.vue';
import CalendarPage from './pages/CalendarPage.vue';
import ReceiptsPage from './pages/ReceiptsPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import AssetFormPage from './pages/AssetFormPage.vue';

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
    { path: '/receipts', name: 'receipts', component: ReceiptsPage, meta: { title: '票据' } },
    { path: '/settings', name: 'settings', component: SettingsPage, meta: { title: '我的' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

createApp(App).use(createPinia()).use(router).mount('#app');
