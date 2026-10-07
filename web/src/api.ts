import type { Block, Box, Certificate, Item, Stats } from './types';
import { processImageFile, type ClientImage } from './lib/image';

export interface UploadedImage {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  palette: string[];
}

async function uploadProcessed(images: ClientImage[], sortBase = 0) {
  const fd = new FormData();
  const meta = images.map((p) => ({ width: p.width, height: p.height, palette: p.palette }));
  for (let i = 0; i < images.length; i++) {
    fd.append(`full_${i}`, images[i].full, `full_${i}.webp`);
    fd.append(`thumb_${i}`, images[i].thumb, `thumb_${i}.webp`);
  }
  fd.append('meta', JSON.stringify(meta));
  return req<{ images: UploadedImage[] }>(`/api/upload?sort=${sortBase}`, { method: 'POST', body: fd });
}
export { uploadProcessed };

const TOKEN_KEY = 'akasha_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? '';
export const setToken = (t: string) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  let data: any = null;
  try { data = await res.json(); } catch { /* 空响应 */ }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('akasha:unauthorized'));
    throw new ApiError(res.status, data?.error ?? `请求失败（${res.status}）`);
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  stats: () => req<Stats>('/api/stats'),

  items: {
    list: (params: Record<string, string>) =>
      req<{ items: Item[] }>(`/api/items?${new URLSearchParams(params)}`),
    get: (id: number | string) => req<{ item: Item }>(`/api/items/${id}`),
    create: (body: Partial<Item> & { imageIds?: number[] }) =>
      req<{ item: Item }>('/api/items', { ...json(body), method: 'POST' }),
    update: (id: number, body: Partial<Item> & { imageIds?: number[] }) =>
      req<{ item: Item }>(`/api/items/${id}`, { ...json(body), method: 'PATCH' }),
    remove: (id: number) => req<{ ok: boolean }>(`/api/items/${id}`, { method: 'DELETE' }),
  },

  boxes: {
    list: () => req<{ boxes: Box[] }>('/api/boxes'),
    get: (id: number | string, reveal = false) =>
      req<{ box: Box }>(`/api/boxes/${id}${reveal ? '?reveal=1' : ''}`),
    create: (body: Record<string, unknown>) => req<{ box: Box }>('/api/boxes', { ...json(body), method: 'POST' }),
    update: (id: number, body: Record<string, unknown>) =>
      req<{ box: Box }>(`/api/boxes/${id}`, { ...json(body), method: 'PATCH' }),
    remove: (id: number) => req<{ ok: boolean }>(`/api/boxes/${id}`, { method: 'DELETE' }),
  },

  resolve: (code: string) =>
    req<{ box: { id: number; code: string; name: string; location: string } }>(`/api/resolve/${encodeURIComponent(code)}`),

  /** 上传原始文件：在浏览器完成 WebP 压缩 + 取色，再交给 Worker 存入 R2 */
  upload: async (files: File[]) => {
    const processed = await Promise.all(files.slice(0, 9).map((f) => processImageFile(f)));
    return uploadProcessed(processed);
  },

  chain: {
    list: () => req<{ blocks: Block[]; verification: { valid: boolean; count: number; brokenAt: number | null }; difficulty: number }>('/api/chain'),
    verify: () => req<{ valid: boolean; count: number; brokenAt: number | null }>('/api/chain/verify'),
  },

  cert: (itemId: number | string) => req<{ certificate: Certificate }>(`/api/cert/${itemId}`),
};
