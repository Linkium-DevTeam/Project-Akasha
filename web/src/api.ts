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
  return req<{ images: UploadedImage[] }>(`/api/write/upload?sort=${sortBase}`, { method: 'POST', body: fd });
}
export { uploadProcessed };

export class ApiError extends Error {
  status: number;
  accessRequired: boolean;
  constructor(status: number, message: string, accessRequired = false) {
    super(message);
    this.status = status;
    this.accessRequired = accessRequired;
  }
}

function signalAccessRequired() {
  window.dispatchEvent(new Event('akasha:access'));
}

/** 同源守卫：API 请求永远只允许打到部署源本身（防路径参数被滥用为任意外域请求） */
function sameOriginUrl(path: string): string {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) throw new ApiError(400, '仅允许同源 API 请求');
  return url.toString();
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const isWrite = path.startsWith('/api/write/');

  let res: Response;
  try {
    // 写通道不跟随重定向：未验证时 Cloudflare Access 会 302 到登录页，
    // redirect:'manual' 让我们拿到 opaqueredirect，从而精确识别「需要验证」
    // （跟随跳转会跨域撞 CORS，只会得到无信息量的网络错误）
    res = await fetch(sameOriginUrl(path), { ...init, headers, redirect: isWrite ? 'manual' : 'follow' });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (isWrite) { signalAccessRequired(); throw new ApiError(401, '需要通过 Cloudflare Access 验证写入', true); }
    throw new ApiError(0, '网络请求失败');
  }
  if (isWrite && res.type === 'opaqueredirect') {
    signalAccessRequired();
    throw new ApiError(401, '需要通过 Cloudflare Access 验证写入', true);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      let data: any = null;
      try { data = await res.json(); } catch { /* 非 JSON */ }
      if (data?.accessRequired || res.status === 401) {
        signalAccessRequired();
        throw new ApiError(res.status, data?.error ?? '需要通过 Cloudflare Access 验证写入', true);
      }
    }
    let data: any = null;
    try { data = await res.json(); } catch { /* 空响应 */ }
    throw new ApiError(res.status, data?.error ?? `请求失败（${res.status}）`);
  }
  if (contentType.includes('text/html')) {
    // 写入请求被 Access 重定向到了登录页 —— 引导用户完成验证
    signalAccessRequired();
    throw new ApiError(401, '需要通过 Cloudflare Access 验证写入', true);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* 空响应 */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `请求失败（${res.status}）`);
  return data as T;
}

export const api = {
  /** 写入会话探测：true = 本设备已通过 Access 验证（7 天内），可放心填写提交 */
  access: {
    check: async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/write/session?probe=1', { redirect: 'manual', cache: 'no-store' });
        return res.type !== 'opaqueredirect';
      } catch {
        return false;
      }
    },
    /** 跳转 Access 验证；验证完成后回程页会带 returnTo 弹回当前页面 */
    start: () => {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      location.href = `/api/write/session?returnTo=${returnTo}`;
    },
  },

  stats: () => req<Stats>('/api/stats'),

  items: {
    list: (params: Record<string, string>) =>
      req<{ items: Item[] }>(`/api/items?${new URLSearchParams(params)}`),
    get: (id: number | string) => req<{ item: Item }>(`/api/items/${id}`),
    create: (body: Partial<Item> & { imageIds?: number[] }) =>
      req<{ item: Item }>('/api/write/items', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Item> & { imageIds?: number[] }) =>
      req<{ item: Item }>(`/api/write/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: number) => req<{ ok: boolean }>(`/api/write/items/${id}`, { method: 'DELETE' }),
  },

  boxes: {
    list: () => req<{ boxes: Box[] }>('/api/boxes'),
    get: (id: number | string, reveal = false) =>
      req<{ box: Box }>(`/api/boxes/${id}${reveal ? '?reveal=1' : ''}`),
    create: (body: Record<string, unknown>) => req<{ box: Box }>('/api/write/boxes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      req<{ box: Box }>(`/api/write/boxes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: number) => req<{ ok: boolean }>(`/api/write/boxes/${id}`, { method: 'DELETE' }),
  },

  resolve: (code: string) =>
    req<{ box: { id: number; code: string; name: string; location: string } }>(`/api/resolve/${encodeURIComponent(code)}`),

  upload: async (files: File[]) => {
    const processed = await Promise.all(files.slice(0, 9).map((f) => processImageFile(f)));
    return uploadProcessed(processed);
  },

  chain: {
    list: () => req<{ blocks: Block[]; verification: { valid: boolean; count: number; brokenAt: number | null }; difficulty: number }>('/api/chain'),
    verify: () => req<{ valid: boolean; count: number; brokenAt: number | null }>('/api/chain/verify'),
  },

  cert: (itemId: number | string) => req<{ certificate: Certificate }>(`/api/cert/${itemId}`),

  ai: {
    /** 传图片 dataURL，返回 AI 识别建议（需审核后手动应用） */
    identify: (image: string) =>
      req<{ suggestion: Record<string, any> }>('/api/write/ai/identify', { method: 'POST', body: JSON.stringify({ image }) }),
    /** 名称 / 系列 → Bangumi 搜索 + AI 整合建议 */
    enrich: (fields: { name?: string; series?: string; character?: string; barcode?: string }) =>
      req<{ suggestion: Record<string, any>; sources: Array<{ name: string; nameCn: string; date: string; summary: string }> }>(
        '/api/write/ai/enrich', { method: 'POST', body: JSON.stringify(fields) },
      ),
  },
};
