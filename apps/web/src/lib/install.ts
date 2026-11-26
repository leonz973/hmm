import { computed, ref } from 'vue';

/** 浏览器给的安装事件（Chrome/Edge/Android） */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const promptEvent = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);
let bound = false;

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/** 在 App 挂载时调用一次，接住浏览器的安装提示 */
export function initInstallPrompt(): void {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  installed.value = isStandalone();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent.value = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installed.value = true;
    promptEvent.value = null;
  });
}

export function useInstall() {
  const canPrompt = computed(() => promptEvent.value !== null);
  const isInstalled = computed(() => installed.value || isStandalone());
  const onIOS = computed(() => isIOS());

  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = promptEvent.value;
    if (!event) return 'unavailable';
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') installed.value = true;
    promptEvent.value = null;
    return outcome;
  }

  return { canPrompt, isInstalled, onIOS, install };
}
