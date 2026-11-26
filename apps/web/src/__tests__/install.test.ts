// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isIOS, isStandalone, useInstall } from '@/lib/install';

describe('安装到桌面', () => {
  it('普通浏览器里识别为未安装', () => {
    expect(isStandalone()).toBe(false);
  });

  it('没有安装事件时 install() 返回 unavailable', async () => {
    const { canPrompt, install } = useInstall();
    expect(canPrompt.value).toBe(false);
    await expect(install()).resolves.toBe('unavailable');
  });

  it('能识别 iOS 设备（jsdom 默认不是）', () => {
    expect(isIOS()).toBe(false);
  });
});
