import type { MiddlewareHandler } from 'hono';

/**
 * 写入门禁（第一层）：
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
 * 写入门禁（第二层，纵深防御）：直接校验 Cloudflare Access 注入的
 * Cf-Access-Jwt-Assertion（RS256 签名 + aud + exp）。
 * 即使有人给 Worker 挂了未经 Access 保护的新域名（如 workers.dev），写入也会在这里被拒。
 * ACCESS_TEAM_DOMAIN / ACCESS_AUD 未配置或本地 localhost 时跳过（本地开发）。
 */

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string; use?: string }

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function getTeamKeys(team: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 3600_000) return jwksCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('无法获取 Access 公钥');
  const data = await res.json<any>();
  jwksCache = { keys: (data.keys ?? []) as Jwk[], fetchedAt: Date.now() };
  return jwksCache.keys;
}

function b64urlBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

export async function verifyAccessJwt(token: string, team: string, aud: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const header = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1])));
  if (header.alg !== 'RS256') return false;
  const audOk = payload.aud === aud || (Array.isArray(payload.aud) && payload.aud.includes(aud));
  if (!audOk) return false;
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return false;
  const keys = await getTeamKeys(team);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return false;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
}

const deny = (c: any, msg: string) => c.json({ error: msg, accessRequired: true }, 403);

export const accessJwtGuard: MiddlewareHandler = async (c, next) => {
  const team = c.env.ACCESS_TEAM_DOMAIN;
  const aud = c.env.ACCESS_AUD;
  const host = new URL(c.req.url).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (!team || !aud || isLocal) return next(); // 本地开发或未配置团队信息时不启用第二层

  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) return deny(c, '缺少 Cloudflare Access 凭证');
  try {
    if (!(await verifyAccessJwt(token, team, aud))) return deny(c, 'Cloudflare Access 凭证无效');
  } catch {
    return deny(c, 'Cloudflare Access 凭证校验失败');
  }
  await next();
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
