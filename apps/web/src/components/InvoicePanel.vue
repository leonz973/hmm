<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  PhPlus as Plus,
  PhTrash as Trash,
  PhPaperclip as Paperclip,
  PhFilePdf as FilePdf,
  PhImage as ImageIcon,
  PhX as X,
  PhReceipt as Receipt,
} from '@phosphor-icons/vue';
import { blobUrl } from '@/lib/idb';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { money, todayISO } from '@/lib/persist';
import { INVOICE_KINDS, useInvoicesStore, type InvoiceKind } from '@/stores/invoices';
import { useAssetsStore } from '@/stores/assets';

const store = useInvoicesStore();
const assets = useAssetsStore();
const auth = useAuthStore();
onMounted(() => {
  store.load();
  assets.load();
});

/** 资产 id → 名称，用于把发票挂到具体设备上 */
const assetName = computed(() => {
  const m = new Map<string, string>();
  for (const a of assets.views) m.set(a.id, a.name);
  return m;
});

const keyword = ref('');
const kindFilter = ref<'全部' | InvoiceKind>('全部');

const filtered = computed(() => {
  const kw = keyword.value.trim();
  return store.sorted.filter((i) => {
    if (kindFilter.value !== '全部' && i.kind !== kindFilter.value) return false;
    if (!kw) return true;
    return i.seller.includes(kw) || i.title.includes(kw) || (i.number ?? '').includes(kw);
  });
});

const modal = ref(false);
const error = ref('');
const file = ref<File | null>(null);

const form = reactive({
  seller: '',
  title: '',
  amountYuan: '',
  date: todayISO(),
  kind: '家电' as InvoiceKind,
  number: '',
  note: '',
  assetIds: [] as string[],
});

function toggleAsset(id: string) {
  const i = form.assetIds.indexOf(id);
  if (i >= 0) form.assetIds.splice(i, 1);
  else form.assetIds.push(id);
}

function open() {
  error.value = '';
  file.value = null;
  form.seller = '';
  form.title = '';
  form.amountYuan = '';
  form.date = todayISO();
  form.kind = '家电';
  form.number = '';
  form.note = '';
  form.assetIds = [];
  modal.value = true;
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
}

async function save() {
  const amount = Math.round(Number(form.amountYuan) * 100);
  if (!form.seller.trim()) return void (error.value = '填一下商家或发票抬头');
  if (!form.title.trim()) return void (error.value = '填一下开票内容');
  if (!Number.isFinite(amount) || amount <= 0) return void (error.value = '金额要大于 0');
  if (!form.date) return void (error.value = '选开票日期');

  await store.create(
    {
      seller: form.seller.trim(),
      title: form.title.trim(),
      amountFen: amount,
      date: form.date,
      kind: form.kind,
      number: form.number.trim() || undefined,
      assetIds: [...form.assetIds],
      note: form.note.trim() || undefined,
    },
    file.value ?? undefined,
  );
  modal.value = false;
}

async function openFile(blobKey?: string) {
  if (!blobKey) return;
  if (auth.isCloud) {
    try {
      const blob = await api.downloadAttachment(blobKey);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert((e as Error).message || '附件打不开');
    }
    return;
  }
  const url = await blobUrl(blobKey);
  if (url) window.open(url, '_blank');
}

function fileIcon(type?: string) {
  return type?.startsWith('image/') ? ImageIcon : FilePdf;
}

function sizeText(bytes?: number) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
</script>

<template>
  <div class="wrap">
    <section class="card hero">
      <div>
        <div class="tiny">发票存档</div>
        <div class="big num">{{ store.items.length }} 张</div>
      </div>
      <div class="divider" />
      <div>
        <div class="tiny">票面合计</div>
        <div class="big num accent">¥{{ money(store.totalFen) }}</div>
        <div class="tiny">{{ store.withFileCount }} 张有附件</div>
      </div>
    </section>

    <div class="filters">
      <input v-model="keyword" class="search" type="search" placeholder="搜商家、内容或发票号" />
      <select v-model="kindFilter" class="kind">
        <option value="全部">全部</option>
        <option v-for="k in INVOICE_KINDS" :key="k" :value="k">{{ k }}</option>
      </select>
    </div>

    <button class="add-line" type="button" @click="open">
      <Plus :size="18" weight="bold" />
      上传一张发票
    </button>

    <div class="list">
      <article v-for="inv in filtered" :key="inv.id" class="card row">
        <div class="row-main">
          <div class="title-row">
            <strong>{{ inv.title }}</strong>
            <span class="tag">{{ inv.kind }}</span>
            <button
              v-if="inv.blobKey"
              class="file-chip"
              type="button"
              :title="inv.fileName"
              @click="openFile(inv.blobKey)"
            >
              <component :is="fileIcon(inv.fileType)" :size="13" />
              {{ sizeText(inv.fileSize) }}
            </button>
          </div>
          <div class="tiny">
            {{ inv.seller }} · {{ inv.date }}
            <template v-if="inv.number"> · No.{{ inv.number }}</template>
          </div>
          <div v-if="inv.assetIds.length" class="linked">
            <span v-for="id in inv.assetIds" :key="id" class="asset-chip">
              {{ assetName.get(id) ?? '已删除的资产' }}
            </span>
          </div>
          <div v-if="inv.note" class="tiny note">{{ inv.note }}</div>
        </div>
        <div class="num amount">¥{{ money(inv.amountFen) }}</div>
        <button class="icon-btn danger" type="button" aria-label="删除" @click="store.remove(inv.id)">
          <Trash :size="16" />
        </button>
      </article>

      <div v-if="!filtered.length" class="card empty">
        <Receipt :size="36" />
        <p>{{ store.items.length ? '没有匹配的发票' : '还没有存档任何发票' }}</p>
        <p class="tiny">把购买电器的发票拍下来存这里，将来维修、理赔、二手转卖都用得上</p>
      </div>
    </div>

    <div v-if="modal" class="overlay" @click.self="modal = false">
      <div class="sheet">
        <div class="sheet-head">
          <strong>上传发票</strong>
          <button class="icon-btn" type="button" aria-label="关闭" @click="modal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="row2">
          <label class="field">
            <span>商家 / 抬头</span>
            <input v-model="form.seller" placeholder="京东商城" />
          </label>
          <label class="field">
            <span>类型</span>
            <select v-model="form.kind">
              <option v-for="k in INVOICE_KINDS" :key="k" :value="k">{{ k }}</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span>开票内容</span>
          <input v-model="form.title" placeholder="海尔冰箱 BCD-501" />
        </label>

        <div class="row2">
          <label class="field">
            <span>金额（元）</span>
            <input v-model="form.amountYuan" type="number" inputmode="decimal" min="0" step="0.01" placeholder="4299" />
          </label>
          <label class="field">
            <span>开票日期</span>
            <input v-model="form.date" type="date" />
          </label>
        </div>

        <label class="field">
          <span>发票号码（可选）</span>
          <input v-model="form.number" placeholder="04412345" />
        </label>

        <div class="field">
          <span>关联资产（可选，可多选）</span>
          <div class="chips">
            <button
              v-for="a in assets.sortedViews"
              :key="a.id"
              type="button"
              class="pick"
              :class="{ on: form.assetIds.includes(a.id) }"
              @click="toggleAsset(a.id)"
            >
              {{ a.name }}
            </button>
            <span v-if="!assets.items.length" class="tiny">还没有资产，可先去「资产」页录入</span>
          </div>
        </div>

        <label class="upload">
          <Paperclip :size="18" />
          <span>{{ file ? file.name : '选择发票照片或 PDF' }}</span>
          <input type="file" accept="image/*,application/pdf" @change="onFile" />
        </label>

        <label class="field">
          <span>备注</span>
          <input v-model="form.note" placeholder="纸质原件放在哪、保修卡编号…" />
        </label>

        <p v-if="error" class="err">{{ error }}</p>

        <div class="sheet-actions">
          <button class="ghost" type="button" @click="modal = false">取消</button>
          <button class="primary wide" type="button" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.linked {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.asset-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-primary-weak);
  color: var(--color-primary-hover);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.pick {
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.pick.on {
  border-color: var(--color-primary);
  background: var(--color-primary-weak);
  color: var(--color-primary-hover);
  font-weight: 600;
}

.wrap {
  display: grid;
  gap: var(--space-md);
}

.hero {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  background: linear-gradient(135deg, var(--color-primary-weak), var(--color-card) 60%);
}

.divider {
  width: 1px;
  align-self: stretch;
  background: var(--color-border);
}

.big {
  font-size: 22px;
  font-weight: 700;
  margin: 2px 0;
}

.accent {
  color: var(--color-accent);
}

.filters {
  display: flex;
  gap: 8px;
}

.search {
  flex: 1;
  min-height: 42px;
  padding: 0 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 14px;
}

.kind {
  min-height: 42px;
  padding: 0 10px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 14px;
}

.add-line {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
}

.list {
  display: grid;
  gap: var(--space-sm);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-md);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  color: var(--color-text-2);
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-primary);
}

.note {
  color: var(--color-text-3);
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text-2);
}

.icon-btn.danger {
  color: var(--color-danger);
}

.empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: var(--space-2xl) var(--space-md);
  color: var(--color-text-3);
  text-align: center;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(15 23 42 / 45%);
}

.sheet {
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  overflow-y: auto;
  display: grid;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-md);
  border-radius: 20px 20px 0 0;
  background: var(--color-card);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.field {
  display: grid;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-2);
}

.field input,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 15px;
  font-family: inherit;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.upload {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 50px;
  padding: 0 14px;
  border-radius: var(--radius-control);
  border: 1px dashed var(--color-border);
  color: var(--color-text-2);
  font-size: 13px;
  cursor: pointer;
  overflow: hidden;
}

.upload span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload input {
  display: none;
}

.err {
  color: var(--color-danger);
  font-size: 13px;
  margin: 0;
}

.sheet-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.primary,
.ghost {
  min-height: 46px;
  border-radius: var(--radius-control);
  font-size: 15px;
}

.primary {
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

.primary.wide {
  flex: 1;
}

.ghost {
  padding: 0 20px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-2);
}

@media (min-width: 640px) {
  .overlay {
    align-items: center;
  }
  .sheet {
    border-radius: 20px;
  }
}
</style>
