/** HMM 前端 API 客户端：统一处理 token、刷新、错误信息 */

const BASE = '/api/v1';

const KEY_ACCESS = 'hmm.access';
const KEY_REFRESH = 'hmm.refresh';
const KEY_HOUSEHOLD = 'hmm.household';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export interface HouseholdMember {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  role: string;
  members: HouseholdMember[];
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface FixedExpensePayload {
  name: string;
  amountFen: number;
  cycle: string;
  dueDate: string;
  category?: string;
  autoPay?: boolean;
  note?: string;
}

export interface BillPayload {
  type: string;
  period: string;
  amountFen: number;
  usage?: string;
  dueDate?: string;
  note?: string;
}

/** 服务端返回的发票（含附件 key） */
export interface InvoiceRecord {
  id: string;
  seller: string;
  title: string;
  amountFen: number;
  date: string;
  kind: string;
  number?: string | null;
  assetIds: string[];
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  blobKey?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface InvoicePayload {
  seller: string;
  title?: string;
  amountFen: number;
  date: string;
  kind?: string;
  number?: string;
  assetIds?: string[];
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  blobKey?: string;
  note?: string;
}

export interface AssetPayload {
  name: string;
  categoryKey?: string;
  categoryName?: string;
  location?: string;
  purchaseDate?: string;
  priceFen?: number;
  warrantyMonths?: number;
  expectedLifeMonths?: number;
  usageLevel?: 'low' | 'mid' | 'high';
  note?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getAccess(): string | null {
  return localStorage.getItem(KEY_ACCESS);
}

export function getRefresh(): string | null {
  return localStorage.getItem(KEY_REFRESH);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(KEY_ACCESS, access);
  localStorage.setItem(KEY_REFRESH, refresh);
}

export function clearSession() {
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem(KEY_HOUSEHOLD);
}

export function getHouseholdId(): string | null {
  return localStorage.getItem(KEY_HOUSEHOLD);
}

export function setHouseholdId(id: string) {
  localStorage.setItem(KEY_HOUSEHOLD, id);
}

let refreshing: Promise<boolean> | null = null;

/** 并发请求同时 401 时只发一次刷新请求 */
async function tryRefresh(): Promise<boolean> {
  const token = getRefresh();
  if (!token) return false;
  refreshing ||= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const data = (await res.json()) as AuthResult;
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const msg = body?.message;
    if (Array.isArray(msg)) return String(msg[0]);
    if (typeof msg === 'string') return msg;
    return `请求失败（${res.status}）`;
  } catch {
    return `请求失败（${res.status}）`;
  }
}

/** 不带 JSON Content-Type 的原始请求（上传 FormData、下载二进制用） */
async function requestRaw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const access = getAccess();
  if (access) headers.Authorization = `Bearer ${access}`;
  const hid = getHouseholdId();
  if (hid) headers['x-household-id'] = hid;

  const res = await fetch(BASE + path, { ...init, headers });
  if (res.status === 401 && retry && getRefresh()) {
    const ok = await tryRefresh();
    if (ok) return requestRaw(path, init, false);
  }
  return res;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';

  const access = getAccess();
  if (access) headers.Authorization = `Bearer ${access}`;
  const hid = getHouseholdId();
  if (hid) headers['x-household-id'] = hid;

  const res = await fetch(BASE + path, { ...init, headers });

  if (res.status === 401 && retry && getRefresh()) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init, false);
  }

  if (!res.ok) throw new ApiError(res.status, await readError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register(email: string, password: string, displayName: string) {
    return request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
  },

  login(email: string, password: string) {
    return request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    const refreshToken = getRefresh();
    if (!refreshToken) return Promise.resolve({ ok: true });
    return request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).finally(() => clearSession());
  },

  me() {
    return request<{ user: AuthUser; households: Array<{ id: string; name: string; role: string }> }>(
      '/auth/me',
    );
  },

  currentHousehold() {
    return request<HouseholdInfo>('/households/current');
  },

  renameHousehold(name: string) {
    return request<{ id: string; name: string }>('/households/current', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  updateHouseholdSettings(payload: { warrantyLeadDays?: number; replaceLeadDays?: number; notifyEmail?: boolean }) {
    return request<{
      id: string;
      name: string;
      warrantyLeadDays: number;
      replaceLeadDays: number;
      notifyEmail: boolean;
    }>('/households/current/settings', { method: 'PATCH', body: JSON.stringify(payload) });
  },

  listReminders<T>() {
    return request<{
      items: T[];
      warrantyLeadDays: number;
      replaceLeadDays: number;
      notifyEmail: boolean;
      smtpConfigured: boolean;
      lastRuns: Array<{ runDate: string; found: number; sent: number; status: string; message?: string | null }>;
    }>('/reminders');
  },

  runReminders(dryRun = false) {
    return request<{ created: number; sent: number; status: string; message?: string | null }>(
      '/reminders/run',
      { method: 'POST', body: JSON.stringify({ dryRun }) },
    );
  },

  async uploadAttachment(file: File, entity: string, entityId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('entity', entity);
    form.append('entityId', entityId);
    const res = await requestRaw('/attachments', { method: 'POST', body: form });
    if (!res.ok) throw new ApiError(res.status, await readError(res));
    return (await res.json()) as {
      attachment: { id: string; name: string; type: string; size: number };
      invoice: InvoiceRecord | null;
    };
  },

  async downloadAttachment(id: string): Promise<Blob> {
    const res = await requestRaw(`/attachments/${id}`);
    if (!res.ok) throw new ApiError(res.status, await readError(res));
    return res.blob();
  },

  deleteAttachment(id: string) {
    return request<{ ok: boolean }>(`/attachments/${id}`, { method: 'DELETE' });
  },

  createInvite() {
    return request<{ code: string; expiresAt: string }>('/households/invites', { method: 'POST' });
  },

  joinHousehold(code: string) {
    return request<{ householdId: string; name: string; already: boolean }>('/households/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  listAssets<T>() {
    return request<T[]>('/assets');
  },

  createAsset<T>(payload: AssetPayload) {
    return request<T>('/assets', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAsset<T>(id: string, payload: Partial<AssetPayload>) {
    return request<T>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAsset(id: string) {
    return request<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' });
  },

  listFixedExpenses<T>() {
    return request<T[]>('/fixed-expenses');
  },
  createFixedExpense<T>(payload: FixedExpensePayload) {
    return request<T>('/fixed-expenses', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateFixedExpense<T>(id: string, payload: Partial<FixedExpensePayload>) {
    return request<T>(`/fixed-expenses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deleteFixedExpense(id: string) {
    return request<{ ok: boolean }>(`/fixed-expenses/${id}`, { method: 'DELETE' });
  },

  listBills<T>() {
    return request<T[]>('/bills');
  },
  createBill<T>(payload: BillPayload) {
    return request<T>('/bills', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateBill<T>(id: string, payload: Partial<BillPayload>) {
    return request<T>(`/bills/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  payBill<T>(id: string) {
    return request<T>(`/bills/${id}/pay`, { method: 'POST' });
  },
  unpayBill<T>(id: string) {
    return request<T>(`/bills/${id}/unpay`, { method: 'POST' });
  },
  deleteBill(id: string) {
    return request<{ ok: boolean }>(`/bills/${id}`, { method: 'DELETE' });
  },

  listInvoices<T>() {
    return request<T[]>('/invoices');
  },
  createInvoice<T>(payload: InvoicePayload) {
    return request<T>('/invoices', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateInvoice<T>(id: string, payload: Partial<InvoicePayload>) {
    return request<T>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deleteInvoice(id: string) {
    return request<{ ok: boolean }>(`/invoices/${id}`, { method: 'DELETE' });
  },
};
