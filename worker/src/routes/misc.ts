import { Hono } from 'hono';
import type { Env } from '../env.js';
import { one, query, run } from '../db.js';
import { requireWriteAuth } from '../auth.js';

export const miscRoutes = new Hono<{ Bindings: Env }>();

/** 随机对象名（Web Crypto，无需 node:crypto） */
const randomKey = () => [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, '0')).join('');

const MAX_OBJECT_BYTES = 12 * 1024 * 1024; // 浏览器端已压缩，单图 12MB 上限只是防御

/* ---------- 图片上传（浏览器已完成 WebP 压缩 + 取色，这里只存 R2 + 写索引） ---------- */

interface UploadMeta {
  width: number;
  height: number;
  palette: string[];
}

miscRoutes.post('/upload', requireWriteAuth, async (c) => {
  const body = await c.req.parseBody();
  let metas: UploadMeta[];
  try {
    metas = JSON.parse(String(body['meta'] ?? '[]'));
  } catch {
    return c.json({ error: 'meta 字段格式错误' }, 400);
  }
  if (!Array.isArray(metas) || metas.length === 0) return c.json({ error: '没有收到图片' }, 400);
  if (metas.length > 9) return c.json({ error: '一次最多 9 张' }, 400);

  const sortBase = Number(c.req.query('sort') ?? 0);
  const results = [];

  for (let i = 0; i < metas.length; i++) {
    const full = body[`full_${i}`];
    const thumb = body[`thumb_${i}`];
    if (typeof full !== 'object' || full === null || !('arrayBuffer' in full)) {
      return c.json({ error: `缺少第 ${i + 1} 张原图` }, 400);
    }
    if (typeof thumb !== 'object' || thumb === null || !('arrayBuffer' in thumb)) {
      return c.json({ error: `缺少第 ${i + 1} 张缩略图` }, 400);
    }
    if (!/^image\/(webp|png)$/.test(full.type)) {
      return c.json({ error: `不支持的类型：${full.type}` }, 400);
    }
    if (full.size > MAX_OBJECT_BYTES || thumb.size > MAX_OBJECT_BYTES) {
      return c.json({ error: '图片过大' }, 400);
    }

    const ext = full.type.includes('png') ? 'png' : 'webp';
    const key = `img_${Date.now().toString(36)}${randomKey()}.${ext}`;
    const thumbKey = `thumb_${key.replace(/^img_/, '')}`;

    const [fullBuf, thumbBuf] = await Promise.all([full.arrayBuffer(), thumb.arrayBuffer()]);
    await Promise.all([
      c.env.BUCKET.put(key, fullBuf, { httpMetadata: { contentType: full.type } }),
      c.env.BUCKET.put(thumbKey, thumbBuf, { httpMetadata: { contentType: full.type } }),
    ]);

    const { lastInsertRowid } = await run(
      c.env.DB,
      'INSERT INTO images (item_id, file, thumb, width, height, palette, sort, created_at) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)',
      key, thumbKey, Number(metas[i].width) || 0, Number(metas[i].height) || 0,
      JSON.stringify(metas[i].palette ?? []), sortBase + i, new Date().toISOString(),
    );
    results.push({
      id: lastInsertRowid,
      url: `/images/${key}`,
      thumbUrl: `/images/${thumbKey}`,
      width: metas[i].width,
      height: metas[i].height,
      palette: metas[i].palette ?? [],
    });
  }
  return c.json({ images: results }, 201);
});

/* ---------- 图片静态服务（R2 直读 + 强缓存，挂根路径 /images） ---------- */

export const imageRoutes = new Hono<{ Bindings: Env }>();

imageRoutes.get('/images/:name', async (c) => {
  const name = c.req.param('name');
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return c.text('Bad Request', 400);
  const obj = await c.env.BUCKET.get(name);
  if (!obj) return c.text('Not Found', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', obj.httpEtag);
  return c.body(obj.body, 200, Object.fromEntries(headers));
});

/* ---------- 盒码解析（Aether Lens 扫码目标） ---------- */

miscRoutes.get('/resolve/:code', async (c) => {
  const code = c.req.param('code').trim().toUpperCase();
  const box = await one(c.env.DB, 'SELECT id, code, name, location FROM boxes WHERE code = ?', code);
  if (!box) return c.json({ error: '未找到该盒码' }, 404);
  return c.json({ box });
});

/* ---------- 统计 ---------- */

miscRoutes.get('/stats', async (c) => {
  const items = (await one<{ c: number }>(c.env.DB, "SELECT COUNT(*) AS c FROM items WHERE status != 'wished'"))!.c;
  const boxes = (await one<{ c: number }>(c.env.DB, 'SELECT COUNT(*) AS c FROM boxes'))!.c;
  const value = (await one<{ v: number | null }>(c.env.DB, "SELECT SUM(price) AS v FROM items WHERE status = 'owned'"))?.v ?? 0;
  const byType = await query<{ type: string; c: number }>(c.env.DB, 'SELECT type, COUNT(*) AS c FROM items GROUP BY type');
  const recent = (await query<{ id: number }>(c.env.DB, 'SELECT id FROM items ORDER BY created_at DESC, id DESC LIMIT 6')).map((r) => r.id);
  return c.json({ items, boxes, value: value ?? 0, byType: byType.map((r) => ({ type: r.type, count: r.c })), recent });
});
