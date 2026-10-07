import { createMiddleware } from 'hono/factory';
import type { Env } from './env.js';

/** 可选访问令牌：设置 AUTH_TOKEN 后所有写操作需要鉴权（读操作保持公开） */
export const requireWriteAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!c.env.AUTH_TOKEN) return next();
  const header = c.req.header('authorization') ?? '';
  const queryToken = c.req.query('token') ?? '';
  if (header === `Bearer ${c.env.AUTH_TOKEN}` || queryToken === c.env.AUTH_TOKEN) return next();
  return c.json({ error: '需要访问令牌（401）' }, 401);
});
