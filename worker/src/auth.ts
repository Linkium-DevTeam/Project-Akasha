import { createMiddleware } from 'hono/factory';

/**
 * 常数时间令牌比较：两侧先做 SHA-256 定长化，再用 Web Crypto timingSafeEqual，
 * 避免直接 === 带来的时序侧信道。
 */
async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(da, db);
}

/** 可选访问令牌：设置 AUTH_TOKEN 后所有写操作需要鉴权（读操作保持公开） */
export const requireWriteAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!c.env.AUTH_TOKEN) return next();
  const header = c.req.header('authorization') ?? '';
  const queryToken = c.req.query('token') ?? '';
  const headerOk = await timingSafeEqualStr(header, `Bearer ${c.env.AUTH_TOKEN}`);
  if (headerOk) return next();
  const queryOk = queryToken.length > 0 && (await timingSafeEqualStr(queryToken, c.env.AUTH_TOKEN));
  if (queryOk) return next();
  return c.json({ error: '需要访问令牌（401）' }, 401);
});
