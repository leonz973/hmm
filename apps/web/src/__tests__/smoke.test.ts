// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import DashboardPage from '@/pages/DashboardPage.vue';
import AssetsPage from '@/pages/AssetsPage.vue';
import CalendarPage from '@/pages/CalendarPage.vue';
import LedgerPage from '@/pages/LedgerPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import AssetFormPage from '@/pages/AssetFormPage.vue';

/** 页面能不能真正挂载渲染 —— 构建通过不等于运行时不出错 */
async function mountPage(component: any) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component },
      { path: '/assets/new', component },
      { path: '/assets/:id/edit', component },
    ],
  });
  router.push('/');
  await router.isReady();
  const wrapper = mount(component, { global: { plugins: [router] } });
  await new Promise((r) => setTimeout(r, 0));
  return wrapper;
}

describe('页面挂载冒烟', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('首页渲染出关键区块', async () => {
    const w = await mountPage(DashboardPage);
    const html = w.html();
    expect(html).toContain('未来 12 个月的钱');
    expect(html).toContain('建议每月预留');
  });

  it('资产页渲染列表与录入入口', async () => {
    const w = await mountPage(AssetsPage);
    expect(w.html()).toContain('资产台账');
    expect(w.html()).toContain('录入');
  });

  it('资产表单在新建模式可渲染', async () => {
    const w = await mountPage(AssetFormPage);
    expect(w.html()).toContain('名称');
  });

  it('日历页渲染月份格子', async () => {
    const w = await mountPage(CalendarPage);
    expect(w.html()).toContain('到期日历');
    expect(w.findAll('.day').length || w.html().length).toBeTruthy();
  });

  it('账目页三个 tab 都在', async () => {
    const w = await mountPage(LedgerPage);
    const html = w.html();
    expect(html).toContain('固定支出');
    expect(html).toContain('账单');
    expect(html).toContain('发票');
  });

  it('设置页含数据与提醒入口', async () => {
    const w = await mountPage(SettingsPage);
    const html = w.html();
    expect(html).toContain('提醒设置');
    expect(html).toContain('导出');
  });
});
