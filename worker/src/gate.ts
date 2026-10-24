import type { MiddlewareHandler } from 'hono';

/**
 * 写入门禁：
 * - 生产环境把所有变更操作放在 /api/write/* 前缀下，由 Cloudflare Access
 *   （应用路径 /api/write*，会话时长设为 1 周）在边缘拦截验证 —— 验证一次后
 *   该设备 7 天内免验证；读操作不受影响。
 * - Worker 自身不做令牌校验；本地 wrangler dev 没有 Access，/api/write/* 直接放行。
 * - 若请求打到公开前缀（/api/items 的 POST 等），一律拒绝，防止绕过 Access。
 */
export const writeGate: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') return next();
  if (c.req.path.startsWith('/api/write/')) return next();
  return c.json({ error: '写入请走 /api/write 通道（受 Cloudflare Access 保护）', accessRequired: true }, 403);
};

/**
 * 写入验证回程页：用户通过 Access 登录后，边缘放行请求到达这里，
 * 由前端脚本带着 returnTo 弹回应用内。未验证时这个路径根本到不了 Worker。
 */
export function sessionPage(url: URL): Response {
  const returnTo = url.searchParams.get('returnTo') ?? '/';
  const safe = /^\/(?!\/)/.test(returnTo) ? returnTo : '/';
  const html = `<!doctype html><meta charset="utf-8"><title>Akasha · 验证完成</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100dvh;margin:0;background:#eef3ff;color:#1c2333">
<div style="text-align:center"><p style="font-size:40px;margin:0">💠</p>
<p style="font-weight:700">写入验证完成，正在返回…</p>
<p style="font-size:12px;color:#8b95ab">该设备 7 天内写入免验证（由 Cloudflare Access 会话保障）</p></div>
<script>location.replace(${JSON.stringify(safe)});</script>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
