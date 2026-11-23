<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  PhArrowLeft as ArrowLeftIcon,
  PhCheck as Check,
  PhTrash as Trash,
} from '@phosphor-icons/vue';
import {
  BUILTIN_CATEGORIES,
  USAGE_LIFE_FACTOR,
  calcReplacementDate,
  calcWarrantyEndDate,
  formatFen,
  parseYuanToFen,
  type UsageLevel,
} from '@hmm/shared';
import { useAssetsStore } from '@/stores/assets';

const route = useRoute();
const router = useRouter();
const store = useAssetsStore();

const editingId = computed(() => (route.params.id as string | undefined) ?? undefined);
const isEdit = computed(() => Boolean(editingId.value));

interface FormState {
  name: string;
  categoryKey: string;
  location: string;
  purchaseDate: string;
  priceYuan: string;
  warrantyMonths: string;
  expectedLifeMonths: string;
  usageLevel: UsageLevel;
  notes: string;
}

const form = reactive<FormState>({
  name: '',
  categoryKey: 'fridge',
  location: '厨房',
  purchaseDate: '',
  priceYuan: '',
  warrantyMonths: '36',
  expectedLifeMonths: '156',
  usageLevel: 'mid',
  notes: '',
});

const errors = reactive<Record<string, string>>({});
const saved = ref(false);

const groupedCategories = computed(() => {
  const parents = BUILTIN_CATEGORIES.filter((c) => !c.parent);
  return parents.map((p) => ({
    key: p.key,
    name: p.name,
    children: BUILTIN_CATEGORIES.filter((c) => c.parent === p.key),
  }));
});

const currentCategory = computed(() => BUILTIN_CATEGORIES.find((c) => c.key === form.categoryKey));

const LOCATIONS = ['厨房', '客厅', '主卧', '次卧', '儿童房', '书房', '餐厅', '阳台', '卫生间', '储物间'];

onMounted(() => {
  store.load();
  if (editingId.value) {
    const asset = store.getById(editingId.value);
    if (!asset) {
      void router.replace('/assets');
      return;
    }
    form.name = asset.name;
    form.categoryKey = asset.categoryKey;
    form.location = asset.location;
    form.purchaseDate = asset.purchaseDate;
    form.priceYuan = (asset.priceFen / 100).toFixed(2);
    form.warrantyMonths = String(asset.warrantyMonths);
    form.expectedLifeMonths = String(asset.expectedLifeMonths);
    form.usageLevel = asset.usageLevel;
    form.notes = asset.notes ?? '';
  } else {
    applyCategoryDefaults();
  }
});

function applyCategoryDefaults() {
  const cat = currentCategory.value;
  if (!cat) return;
  if (cat.warrantyMonths !== undefined) form.warrantyMonths = String(cat.warrantyMonths);
  if (cat.lifeMonths !== undefined) form.expectedLifeMonths = String(cat.lifeMonths);
}

function onCategoryChange() {
  applyCategoryDefaults();
}

const priceFen = computed(() => parseYuanToFen(form.priceYuan) ?? 0);

const preview = computed(() => {
  if (!form.purchaseDate) return null;
  const warrantyMonths = Number(form.warrantyMonths) || 0;
  const baseLife = Number(form.expectedLifeMonths) || 0;
  const lifeMonths = Math.round(baseLife * USAGE_LIFE_FACTOR[form.usageLevel]);
  const warrantyEnd = calcWarrantyEndDate(form.purchaseDate, warrantyMonths);
  const replaceAt = lifeMonths > 0 ? calcReplacementDate(form.purchaseDate, lifeMonths, 'mid') : '';
  const days = replaceAt
    ? Math.round((new Date(replaceAt + 'T00:00:00').getTime() - Date.now()) / 86400000)
    : 0;
  return { warrantyEnd, replaceAt, lifeMonths, days, priceFen: priceFen.value };
});

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k]);
  if (!form.name.trim()) errors.name = '给这件东西起个名字';
  if (!form.purchaseDate) errors.purchaseDate = '购买日期用于推算质保和寿命';
  if (priceFen.value <= 0) errors.priceYuan = '填个价格，才能算换新要多少钱';
  const life = Number(form.expectedLifeMonths);
  if (!Number.isFinite(life) || life <= 0) errors.expectedLifeMonths = '预计使用月数必须大于 0';
  return Object.keys(errors).length === 0;
}

function submit() {
  if (!validate()) return;
  const payload = {
    name: form.name.trim(),
    categoryKey: form.categoryKey,
    categoryName: currentCategory.value?.name ?? form.categoryKey,
    location: form.location,
    purchaseDate: form.purchaseDate,
    priceFen: priceFen.value,
    warrantyMonths: Number(form.warrantyMonths) || 0,
    expectedLifeMonths: Number(form.expectedLifeMonths),
    usageLevel: form.usageLevel,
    notes: form.notes.trim() || undefined,
  };
  if (editingId.value) {
    store.update(editingId.value, payload);
  } else {
    store.create(payload);
  }
  saved.value = true;
  setTimeout(() => void router.push('/assets'), 260);
}

function removeAsset() {
  if (!editingId.value) return;
  if (confirm('确定删除这件资产？删除后无法恢复。')) {
    store.remove(editingId.value);
    void router.push('/assets');
  }
}

const usageOptions: Array<{ value: UsageLevel; label: string; hint: string }> = [
  { value: 'low', label: '用得少', hint: '偶尔使用，寿命 ×1.2' },
  { value: 'mid', label: '正常', hint: '日常使用，寿命 ×1.0' },
  { value: 'high', label: '用得多', hint: '高频使用，寿命 ×0.8' },
];
</script>

<template>
  <div class="page">
    <div class="head">
      <button class="icon-btn" type="button" aria-label="返回" @click="router.back()">
        <ArrowLeftIcon :size="20" />
      </button>
      <h1>{{ isEdit ? '编辑资产' : '录入资产' }}</h1>
      <button v-if="isEdit" class="icon-btn danger" type="button" aria-label="删除" @click="removeAsset">
        <Trash :size="18" />
      </button>
    </div>

    <form class="card form" @submit.prevent="submit">
      <label class="field">
        <span class="label">名称 <em>*</em></span>
        <input v-model="form.name" type="text" placeholder="例如：海尔冰箱 BCD-501" :class="{ invalid: errors.name }" />
        <span v-if="errors.name" class="err">{{ errors.name }}</span>
      </label>

      <label class="field">
        <span class="label">品类</span>
        <select v-model="form.categoryKey" @change="onCategoryChange">
          <optgroup v-for="g in groupedCategories" :key="g.key" :label="g.name">
            <option v-for="c in g.children" :key="c.key" :value="c.key">{{ c.name }}</option>
          </optgroup>
        </select>
        <span class="tiny">选品类会自动带出常见质保与寿命，可以改</span>
      </label>

      <div class="row2">
        <label class="field">
          <span class="label">放在哪</span>
          <input v-model="form.location" type="text" list="hmm-locations" placeholder="厨房" />
          <datalist id="hmm-locations">
            <option v-for="l in LOCATIONS" :key="l" :value="l" />
          </datalist>
        </label>

        <label class="field">
          <span class="label">购买日期 <em>*</em></span>
          <input
            v-model="form.purchaseDate"
            type="date"
            :max="new Date().toISOString().slice(0, 10)"
            :class="{ invalid: errors.purchaseDate }"
          />
          <span v-if="errors.purchaseDate" class="err">{{ errors.purchaseDate }}</span>
        </label>
      </div>

      <div class="row2">
        <label class="field">
          <span class="label">购买价格（元）<em>*</em></span>
          <input
            v-model="form.priceYuan"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="4299"
            :class="{ invalid: errors.priceYuan }"
          />
          <span v-if="errors.priceYuan" class="err">{{ errors.priceYuan }}</span>
        </label>

        <label class="field">
          <span class="label">质保（月）</span>
          <input v-model="form.warrantyMonths" type="number" min="0" step="1" placeholder="36" />
          <span class="tiny">0 表示没有质保</span>
        </label>
      </div>

      <label class="field">
        <span class="label">预计能用到（月）</span>
        <input
          v-model="form.expectedLifeMonths"
          type="number"
          min="1"
          step="1"
          :class="{ invalid: errors.expectedLifeMonths }"
        />
        <span v-if="errors.expectedLifeMonths" class="err">{{ errors.expectedLifeMonths }}</span>
        <span v-else class="tiny">不知道该填多少就用品类默认值，之后随时改</span>
      </label>

      <div class="field">
        <span class="label">使用强度</span>
        <div class="segmented" role="group">
          <button
            v-for="opt in usageOptions"
            :key="opt.value"
            type="button"
            :class="{ active: form.usageLevel === opt.value }"
            @click="form.usageLevel = opt.value"
          >
            <strong>{{ opt.label }}</strong>
            <small>{{ opt.hint }}</small>
          </button>
        </div>
      </div>

      <label class="field">
        <span class="label">备注</span>
        <textarea v-model="form.notes" rows="2" placeholder="发票放哪了、型号、保修卡编号…" />
      </label>

      <section v-if="preview" class="preview">
        <div class="preview-head">大概是这样</div>
        <div class="preview-grid">
          <div>
            <div class="tiny">质保到期</div>
            <div class="pv">{{ preview.warrantyEnd }}</div>
          </div>
          <div v-if="preview.replaceAt">
            <div class="tiny">预计要换新</div>
            <div class="pv">{{ preview.replaceAt }}</div>
            <div class="tiny" :class="{ warn: preview.days < 365 }">
              {{ preview.days < 0 ? `已超期 ${-preview.days} 天` : `还有 ${preview.days} 天` }}
            </div>
          </div>
          <div v-if="priceFen > 0">
            <div class="tiny">换新大约要</div>
            <div class="pv accent">¥{{ formatFen(priceFen) }}</div>
            <div class="tiny">按今天的价格估</div>
          </div>
        </div>
      </section>

      <div class="actions">
        <button class="primary" type="submit">
          <component :is="saved ? Check : Check" :size="18" weight="bold" />
          {{ saved ? '已保存' : '保存' }}
        </button>
        <button class="ghost" type="button" @click="router.back()">取消</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-md);
  max-width: 720px;
  margin: 0 auto;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
}

h1 {
  font-size: 19px;
  font-weight: 600;
  flex: 1;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-2);
}

.icon-btn.danger {
  color: var(--color-danger);
}

.form {
  display: grid;
  gap: var(--space-md);
}

.field {
  display: grid;
  gap: 6px;
}

.row2 {
  display: grid;
  gap: var(--space-md);
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
}

.label em {
  color: var(--color-danger);
  font-style: normal;
}

input,
select,
textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
}

textarea {
  resize: vertical;
  min-height: 64px;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

input.invalid {
  border-color: var(--color-danger);
}

.err {
  font-size: 12px;
  color: var(--color-danger);
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.segmented button {
  display: grid;
  gap: 2px;
  padding: 10px 8px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-2);
  text-align: left;
  transition: all 0.15s var(--ease-out);
}

.segmented button small {
  font-size: 11px;
  color: var(--color-text-3);
  line-height: 1.3;
}

.segmented button.active {
  border-color: var(--color-primary);
  background: var(--color-primary-weak);
  color: var(--color-primary);
}

.segmented button.active small {
  color: var(--color-primary);
}

.preview {
  padding: var(--space-md);
  border-radius: var(--radius-control);
  background: var(--color-bg);
  border: 1px dashed var(--color-border);
}

.preview-head {
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 8px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-md);
}

.pv {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pv.accent {
  color: var(--color-accent);
}

.warn {
  color: var(--color-accent);
}

.actions {
  display: flex;
  gap: var(--space-sm);
  position: sticky;
  bottom: 0;
  background: var(--color-card);
  padding-top: var(--space-sm);
}

.primary {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  border: none;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.primary:hover {
  background: var(--color-primary-hover);
}

.ghost {
  min-height: 48px;
  padding: 0 20px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-2);
  font-size: 15px;
}

@media (min-width: 640px) {
  .row2 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
