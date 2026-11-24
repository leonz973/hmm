import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { computed, ref, watch } from 'vue';
import { delBlob, putBlob } from '@/lib/idb';
import { loadJSON, saveJSON, todayISO, uid } from '@/lib/persist';

export const INVOICE_KINDS = ['家电', '家具', '装修', '维修', '生活服务', '其他'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export interface Invoice {
  id: string;
  /** 发票抬头/商户 */
  seller: string;
  /** 开票内容，例如「冰箱」 */
  title: string;
  amountFen: number;
  /** 开票日期 YYYY-MM-DD */
  date: string;
  kind: InvoiceKind;
  /** 发票号码（可选） */
  number?: string;
  /** 关联的资产 id，可多个（一笔发票可能含多件商品） */
  assetIds: string[];
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  /** IndexedDB 里的 Blob key */
  blobKey?: string;
  note?: string;
  createdAt: string;
}

const STORAGE_KEY = 'hmm.invoices.v1';

function seed(): Invoice[] {
  const now = new Date().toISOString();
  return [
    {
      id: uid(),
      seller: '京东商城',
      title: '海尔冰箱 BCD-501',
      amountFen: 429900,
      date: '2019-05-18',
      kind: '家电',
      number: '04412345',
      assetIds: [],
      note: '保修卡在冰箱说明书袋里',
      createdAt: now,
    },
    {
      id: uid(),
      seller: '苏宁易购',
      title: '小米空调 1.5匹',
      amountFen: 269900,
      date: '2021-06-02',
      kind: '家电',
      number: '04498761',
      assetIds: [],
      createdAt: now,
    },
  ];
}

export const useInvoicesStore = defineStore('invoices', () => {
  const items = ref<Invoice[]>([]);
  const loaded = ref(false);

  const auth = useAuthStore();
  const syncing = ref(false);

  async function hydrateFromCloud() {
    syncing.value = true;
    try {
      items.value = await api.listInvoices<Invoice>();
    } finally {
      syncing.value = false;
    }
  }

  function load() {
    if (loaded.value) return;
    loaded.value = true;

    if (auth.isCloud) {
      void hydrateFromCloud();
      return;
    }
    const stored = loadJSON<Invoice[] | null>(STORAGE_KEY, null);
    items.value = Array.isArray(stored) ? stored : seed();
  }

  watch(
    items,
    (v) => {
      if (!loaded.value) return;
      if (auth.isCloud) return;
      saveJSON(STORAGE_KEY, v);
    },
    { deep: true },
  );

  const sorted = computed(() =>
    [...items.value].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
  );

  const totalFen = computed(() => items.value.reduce((s, i) => s + i.amountFen, 0));

  const thisYearFen = computed(() => {
    const y = String(new Date().getFullYear());
    return items.value.filter((i) => i.date.startsWith(y)).reduce((s, i) => s + i.amountFen, 0);
  });

  const withFileCount = computed(() => items.value.filter((i) => i.blobKey).length);

  async function create(input: Omit<Invoice, 'id' | 'createdAt'>, file?: File): Promise<string> {
    const id = uid();
    const invoice: Invoice = { ...input, id, createdAt: new Date().toISOString() };

    if (file) {
      const blobKey = `invoice-${id}`;
      try {
        await putBlob(blobKey, file);
        invoice.blobKey = blobKey;
        invoice.fileName = file.name;
        invoice.fileType = file.type;
        invoice.fileSize = file.size;
      } catch {
        // 存附件失败不该丢掉整张发票记录
      }
    }

    if (auth.isCloud) {
      const saved = await api.createInvoice<Invoice>({
        seller: invoice.seller,
        title: invoice.title,
        amountFen: invoice.amountFen,
        date: invoice.date,
        kind: invoice.kind,
        number: invoice.number,
        assetIds: invoice.assetIds,
        fileName: invoice.fileName,
        fileType: invoice.fileType,
        fileSize: invoice.fileSize,
        blobKey: invoice.blobKey,
        note: invoice.note,
      });
      items.value.unshift(saved);
      return saved.id;
    }

    items.value.push(invoice);
    return id;
  }

  async function remove(id: string) {
    if (auth.isCloud) {
      await api.deleteInvoice(id);
    }
    const target = items.value.find((i) => i.id === id);
    if (target?.blobKey) {
      try {
        await delBlob(target.blobKey);
      } catch {
        /* 附件删不掉不影响主流程 */
      }
    }
    items.value = items.value.filter((i) => i.id !== id);
  }

  async function linkAssets(id: string, assetIds: string[]) {
    if (auth.isCloud) {
      const saved = await api.updateInvoice<Invoice>(id, { assetIds });
      const i = items.value.findIndex((x) => x.id === id);
      if (i >= 0) items.value[i] = saved;
      return;
    }
    const inv = items.value.find((i) => i.id === id);
    if (inv) inv.assetIds = assetIds;
  }

  function restoreDemo() {
    items.value = seed();
  }

  function clearAll() {
    items.value = [];
  }

  return {
    items,
    loaded,
    syncing,
    hydrateFromCloud,
    sorted,
    totalFen,
    thisYearFen,
    withFileCount,
    load,
    create,
    remove,
    linkAssets,
    restoreDemo,
    clearAll,
  };
});

export const today = todayISO;
