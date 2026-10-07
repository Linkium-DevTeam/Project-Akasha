import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { Env } from './env.js';
import { ensureGenesis } from './chain.js';
import { itemsRoutes } from './routes/items.js';
import { boxesRoutes } from './routes/boxes.js';
import { miscRoutes, imageRoutes } from './routes/misc.js';
import { certRoutes, chainRoutes } from './routes/cert.js';

const app = new Hono<{ Bindings: Env }>();

app.use(logger());

// 创世区块懒初始化：每个 isolate 只做一次检查
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
api.route('/items', itemsRoutes);
api.route('/boxes', boxesRoutes);
api.route('/cert', certRoutes);
api.route('/', chainRoutes);
api.route('/', miscRoutes); // /api/upload /api/resolve/:code /api/stats
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
