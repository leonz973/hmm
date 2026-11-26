// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, h } from 'vue';

vi.mock('@/lib/install', () => ({ initInstallPrompt: vi.fn() }));

import App from '@/App.vue';

const Blank = defineComponent({ render: () => h('div', 'blank') });

async function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Blank },
      { path: '/assets', component: Blank },
      { path: '/calendar', component: Blank },
      { path: '/receipts', component: Blank },
      { path: '/settings', component: Blank },
      { path: '/login', component: Blank },
    ],
  });
  router.push('/');
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] } });
  await new Promise((r) => setTimeout(r, 0));
  return { wrapper, router };
}

describe('底部导航', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('点「资产」会真的切到 /assets', async () => {
    const { wrapper, router } = await mountApp();
    const tab = wrapper.findAll('.tab').find((t) => t.text().includes('资产'));
    expect(tab).toBeTruthy();
    await tab!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.path).toBe('/assets');
    // 关键：导航元素必须是 button，不能是 <a href>（移动端会被浏览器接管成整页导航）
    expect(tab!.element.tagName).toBe('BUTTON');
  });
});
