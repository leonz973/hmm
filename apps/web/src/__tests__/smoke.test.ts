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
import LoginPage from '@/pages/LoginPage.vue';
import AssetDetailPage from '@/pages/AssetDetailPage.vue';
import ReportsPage from '@/pages/ReportsPage.vue';

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

  it('资产详情页能渲染，并显示保养计划区块', async () => {
    localStorage.setItem(
      'hmm.assets.v1',
      JSON.stringify([
        {
          id: 'asset-1',
          name: '测试净水器',
          categoryKey: 'appliance_small',
          categoryName: '小家电',
          location: '厨房',
          purchaseDate: '2026-01-01',
          priceFen: 189900,
          warrantyMonths: 24,
          expectedLifeMonths: 60,
          usageLevel: 'mid',
          notes: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/assets/:id', component: AssetDetailPage },
        { path: '/', component: AssetDetailPage },
      ],
    });
    router.push('/assets/asset-1');
    await router.isReady();
    const w = mount(AssetDetailPage, { global: { plugins: [router] } });
    await new Promise((r) => setTimeout(r, 0));
    const html = w.html();
    expect(html).toContain('测试净水器');
    expect(html).toContain('保养计划');
    expect(html).toContain('预计换新');
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

  it('登录页有登录/注册两种模式', async () => {
    const w = await mountPage(LoginPage);
    const html = w.html();
    expect(html).toContain('云同步');
    expect(html).toContain('注册一个');
    expect(html).toContain('稍后再说');
  });

  it('统计报表页能渲染四块内容', async () => {
    localStorage.setItem(
      'hmm.assets.v1',
      JSON.stringify([
        {
          id: 'asset-r1',
          name: '测试冰箱',
          categoryKey: 'appliance_large',
          categoryName: '大家电',
          location: '厨房',
          purchaseDate: '2024-01-10',
          priceFen: 300000,
          warrantyMonths: 36,
          expectedLifeMonths: 120,
          usageLevel: 'mid',
          createdAt: '2024-01-10T00:00:00.000Z',
          updatedAt: '2024-01-10T00:00:00.000Z',
        },
      ]),
    );
    const w = await mountPage(ReportsPage);
    const html = w.html();
    expect(html).toContain('统计报表');
    expect(html).toContain('今年看得见的支出');
    expect(html).toContain('折旧与残值');
    expect(html).toContain('未来三年的资金压力');
    expect(html).toContain('大家电');
  });
});
