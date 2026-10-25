import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { ensureGenesis } from './chain.js';
import { sessionPage, accessJwtGuard } from './gate.js';
import { itemsRoutes } from './routes/items.js';
import { boxesRoutes } from './routes/boxes.js';
import { miscRoutes, imageRoutes } from './routes/misc.js';
import { certRoutes, chainRoutes } from './routes/cert.js';
import { aiRoutes } from './routes/ai.js';

const app = new Hono<{ Bindings: Env }>();

/** 结构化 JSON 请求日志（Workers Logs 可检索） */
const jsonLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  console.log(JSON.stringify({
    message: 'request',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
  }));
};

const onError = (err: Error, c: any) => {
  console.error(JSON.stringify({
    message: 'unhandled error',
    error: err instanceof Error ? err.message : String(err),
    path: c.req.path,
  }));
  return c.json({ error: '服务器内部错误' }, 500);
};
app.onError(onError);

app.use(jsonLogger);

// 创世区块懒初始化：每个 isolate 只做一次检查（latch 缓存的是全局不变量，非请求态数据）
let genesisChecked = false;
app.use('/api/*', async (c, next) => {
  if (!genesisChecked) {
    await ensureGenesis(c.env);
    genesisChecked = true;
  }
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'akasha', runtime: 'cloudflare-workers', time: new Date().toISOString() }));

const api = new Hono<{ Bindings: Env }>();

// 公开读通道
api.route('/items', itemsRoutes);
api.route('/boxes', boxesRoutes);
api.route('/cert', certRoutes);
api.route('/', chainRoutes);
api.route('/', miscRoutes);

// 写通道：挂载在同一组路由，writeGate 只放行 /api/write/* 前缀；
// 生产环境该前缀整体由 Cloudflare Access（路径 /api/write*，会话 1 周）在边缘验证，
// 并由 accessJwtGuard 直接校验 Access 注入的 JWT（纵深防御：任何未经 Access
// 保护的入口 —— 例如误开的其他域名 —— 写入都会在这里被拒）
api.use('/write/*', accessJwtGuard);
api.route('/write/items', itemsRoutes);
api.route('/write/boxes', boxesRoutes);
api.route('/write', miscRoutes); // /api/write/upload /api/write/ai 之前的通用挂载
api.route('/write/ai', aiRoutes);

// Access 验证完成的回程：能到达这里说明已通过验证（同样受 JWT 校验保护）
app.get('/api/write/session', accessJwtGuard, (c) => sessionPage(new URL(c.req.url)));

app.route('/api', api);
app.route('/', imageRoutes); // /images/:name（R2 直读）

// SPA 回退：静态资源由 Workers Static Assets 直接命中（不进 Worker），
// 未命中资源且非 API 的路径（如 /items/1、/b/AKS-XXXX）统一回退到 index.html
app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: '接口不存在' }, 404);
  if (c.req.path.startsWith('/images/')) return c.text('Not Found', 404);
  return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url).toString()));
});

export default app;
