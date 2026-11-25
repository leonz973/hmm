// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setTokens, setHouseholdId, clearSession } from '@/lib/api';

/**
 * 附件上传走的是 FormData，一旦被塞上 Content-Type: application/json
 * 浏览器就不会自己写 boundary，后端 multer 会直接收不到文件。
 */
describe('附件上传请求', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    clearSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it('用 FormData 上传，且不设置 Content-Type', async () => {
    setTokens('access-1', 'refresh-1');
    setHouseholdId('hid-1');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          attachment: { id: 'att-1', name: 'a.pdf', type: 'application/pdf', size: 10 },
          invoice: null,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    const res = await api.uploadAttachment(file, 'invoice', 'inv-1');

    expect(res.attachment.id).toBe('att-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/attachments');
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer access-1');
    expect(headers['x-household-id']).toBe('hid-1');

    const form = init.body as FormData;
    expect(form.get('entity')).toBe('invoice');
    expect(form.get('entityId')).toBe('inv-1');
    expect((form.get('file') as File).name).toBe('a.pdf');
  });

  it('下载附件时取回二进制而不是 JSON', async () => {
    setTokens('access-2', 'refresh-2');
    fetchMock.mockResolvedValue(
      new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );

    const blob = await api.downloadAttachment('att-2');
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('pdf');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/attachments/att-2');
  });

  it('没有登录态时不会带 Authorization', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await api.downloadAttachment('att-3');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
