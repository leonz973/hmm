<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhArrowLeft as ArrowLeftIcon, PhCloudArrowUp as CloudIcon } from '@phosphor-icons/vue';
import { useAuthStore } from '@/stores/auth';
import { useAssetsStore } from '@/stores/assets';

const router = useRouter();
const auth = useAuthStore();
const assets = useAssetsStore();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const displayName = ref('');
const error = ref('');
const busy = ref(false);

const title = computed(() => (mode.value === 'login' ? '登录' : '注册'));
const canSubmit = computed(
  () => email.value.includes('@') && password.value.length >= 8 && (mode.value === 'login' || displayName.value.trim().length > 0),
);

function switchMode(next: 'login' | 'register') {
  mode.value = next;
  error.value = '';
}

async function submit() {
  if (!canSubmit.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    if (mode.value === 'login') {
      await auth.login(email.value.trim(), password.value);
    } else {
      await auth.register(email.value.trim(), password.value, displayName.value.trim());
    }
    // 登录后立刻把云端的资产拉下来
    await assets.hydrateFromCloud();
    void router.replace('/');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败，请重试';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page narrow">
    <button class="back" type="button" @click="router.push('/')">
      <ArrowLeftIcon :size="18" />
      <span>稍后再说</span>
    </button>

    <section class="card hero">
      <div class="badge"><CloudIcon :size="18" weight="fill" /> 云同步</div>
      <h1>{{ title }}后，家里几台设备看到的是同一份账</h1>
      <p class="tiny">
        登录后数据存在服务器，家人用同一个家庭空间一起记。不登录也能用，但数据只在这台设备的浏览器里。
      </p>
    </section>

    <section class="card form-card">
      <div class="tabs">
        <button type="button" :class="{ on: mode === 'login' }" @click="switchMode('login')">登录</button>
        <button type="button" :class="{ on: mode === 'register' }" @click="switchMode('register')">注册</button>
      </div>

      <label class="field" v-if="mode === 'register'">
        <span>你的称呼</span>
        <input v-model="displayName" type="text" placeholder="比如：小磊" autocomplete="nickname" />
      </label>

      <label class="field">
        <span>邮箱</span>
        <input v-model="email" type="email" placeholder="you@example.com" autocomplete="email" />
      </label>

      <label class="field">
        <span>密码</span>
        <input
          v-model="password"
          type="password"
          :placeholder="mode === 'register' ? '至少 8 位' : '输入密码'"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          @keyup.enter="submit"
        />
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <button class="primary" type="button" :disabled="!canSubmit || busy" @click="submit">
        {{ busy ? '处理中…' : mode === 'login' ? '登录' : '注册并创建我的家' }}
      </button>

      <p class="tiny center">
        {{ mode === 'login' ? '还没有账号？' : '已经有账号了？' }}
        <a href="#" @click.prevent="switchMode(mode === 'login' ? 'register' : 'login')">
          {{ mode === 'login' ? '注册一个' : '去登录' }}
        </a>
      </p>
    </section>

    <p class="tiny center">忘记密码暂时需要联系管理员重置（邮件找回在 M2 收尾时补上）</p>
  </div>
</template>

<style scoped>
.narrow {
  max-width: 520px;
  margin: 0 auto;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 14px;
  padding: 4px 0;
  cursor: pointer;
}

.hero {
  margin-top: var(--space-md);
  display: grid;
  gap: var(--space-sm);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.hero h1 {
  font-size: 20px;
  line-height: 1.4;
  margin: 0;
}

.form-card {
  display: grid;
  gap: var(--space-md);
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: var(--color-bg);
  padding: 4px;
  border-radius: var(--radius-control);
}

.tabs button {
  border: 0;
  background: transparent;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-muted);
  cursor: pointer;
}

.tabs button.on {
  background: var(--color-card);
  color: var(--color-text);
  font-weight: 600;
  box-shadow: var(--shadow-card);
}

.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--color-muted);
}

.field input {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 11px 12px;
  font-size: 15px;
  color: var(--color-text);
  background: var(--color-card);
}

.field input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.primary {
  border: 0;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  padding: 12px;
  cursor: pointer;
}

.primary:disabled {
  background: color-mix(in srgb, var(--color-primary) 40%, #fff);
  cursor: not-allowed;
}

.error {
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
  background: #fef2f2;
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
