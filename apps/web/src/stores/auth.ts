import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  api,
  clearSession,
  getAccess,
  getHouseholdId,
  setHouseholdId,
  setTokens,
  type AuthUser,
  type HouseholdInfo,
} from '@/lib/api';

/**
 * 账号状态。
 * 没登录 = 本地模式（数据只在当前浏览器）；登录后 = 云同步（数据在服务器，家人共享）。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const household = ref<HouseholdInfo | null>(null);
  const ready = ref(false);
  const busy = ref(false);

  const isCloud = computed(() => Boolean(user.value));
  const modeLabel = computed(() => (isCloud.value ? '云同步' : '本地模式'));

  /** 应用启动时调用：有 token 就恢复登录态 */
  async function init() {
    if (!getAccess()) {
      ready.value = true;
      return;
    }
    try {
      const me = await api.me();
      user.value = me.user;
      const hid = getHouseholdId();
      const target = me.households.find((h) => h.id === hid) ?? me.households[0];
      if (target) setHouseholdId(target.id);
      household.value = await api.currentHousehold();
    } catch {
      clearSession();
      user.value = null;
      household.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function afterLogin(result: { user: AuthUser; accessToken: string; refreshToken: string }) {
    setTokens(result.accessToken, result.refreshToken);
    user.value = result.user;
    const me = await api.me();
    const first = me.households[0];
    if (first) setHouseholdId(first.id);
    household.value = await api.currentHousehold();
  }

  async function login(email: string, password: string) {
    busy.value = true;
    try {
      await afterLogin(await api.login(email, password));
    } finally {
      busy.value = false;
    }
  }

  async function register(email: string, password: string, displayName: string) {
    busy.value = true;
    try {
      await afterLogin(await api.register(email, password, displayName));
    } finally {
      busy.value = false;
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined);
    clearSession();
    user.value = null;
    household.value = null;
  }

  async function refreshHousehold() {
    if (!isCloud.value) return;
    household.value = await api.currentHousehold();
  }

  async function invite() {
    return api.createInvite();
  }

  async function join(code: string) {
    const result = await api.joinHousehold(code);
    setHouseholdId(result.householdId);
    household.value = await api.currentHousehold();
    return result;
  }

  async function rename(name: string) {
    await api.renameHousehold(name);
    await refreshHousehold();
  }

  return {
    user,
    household,
    ready,
    busy,
    isCloud,
    modeLabel,
    init,
    login,
    register,
    logout,
    refreshHousehold,
    invite,
    join,
    rename,
  };
});
