import { Hono } from 'hono';
import type { Env } from '../env.js';
import { one, query } from '../db.js';
import { requireWriteAuth } from '../auth.js';
import { createItem, updateItem, deleteItem, type ItemInput } from '../services.js';

export interface ItemRow {
  id: number; name: string; series: string; character: string; type: string; status: string;
  condition: string; price: number | null; currency: string; purchased_at: string; notes: string;
  barcode: string; tags: string; box_id: number | null; created_at: string; updated_at: string;
}

export function serializeItem(item: ItemRow, images: any[], box: any) {
  return {
    id: item.id, name: item.name, series: item.series, character: item.character,
    type: item.type, status: item.status, condition: item.condition,
    price: item.price, currency: item.currency,
    purchasedAt: item.purchased_at, notes: item.notes, barcode: item.barcode,
    tags: item.tags ? item.tags.split(',').filter(Boolean) : [],
    boxId: item.box_id, box, images, createdAt: item.created_at, updatedAt: item.updated_at,
  };
}

async function loadImages(db: D1Database, itemId: number) {
  const rows = await query<any>(db, 'SELECT * FROM images WHERE item_id = ? ORDER BY sort ASC, id ASC', itemId);
  return rows.map((img) => ({
    id: img.id,
    url: `/images/${img.file}`,
    thumbUrl: `/images/${img.thumb}`,
    width: img.width,
    height: img.height,
    palette: JSON.parse(img.palette || '[]'),
  }));
}

async function fullItem(env: Env, id: number) {
  const item = await one<ItemRow>(env.DB, 'SELECT * FROM items WHERE id = ?', id);
  if (!item) return undefined;
  const [images, box] = await Promise.all([
    loadImages(env.DB, id),
    item.box_id
      ? one(env.DB, 'SELECT id, code, name, location, color FROM boxes WHERE id = ?', item.box_id)
      : Promise.resolve(null),
  ]);
  return serializeItem(item, images, box);
}

const parseItemInput = async (c: any): Promise<ItemInput> => {
  const b = await c.req.json();
  return {
    name: String(b.name ?? '').trim(),
    series: String(b.series ?? '').trim(),
    character: String(b.character ?? '').trim(),
    type: String(b.type ?? 'badge'),
    status: String(b.status ?? 'owned'),
    condition: String(b.condition ?? 'mint'),
    price: b.price === null || b.price === '' || b.price === undefined ? null : Number(b.price),
    currency: String(b.currency ?? 'CNY'),
    purchasedAt: String(b.purchasedAt ?? ''),
    notes: String(b.notes ?? ''),
    barcode: String(b.barcode ?? '').trim(),
    tags: Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [],
    boxId: b.boxId ? Number(b.boxId) : null,
    imageIds: Array.isArray(b.imageIds) ? b.imageIds.map((n: unknown) => Number(n)) : [],
  };
};

export const itemsRoutes = new Hono<{ Bindings: Env }>();

itemsRoutes.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const type = c.req.query('type') ?? '';
  const status = c.req.query('status') ?? '';
  const boxId = c.req.query('boxId') ?? '';
  const barcode = (c.req.query('barcode') ?? '').trim();
  const sort = c.req.query('sort') === 'price' ? 'price' : 'created';
  const order = c.req.query('order') === 'asc' ? 'ASC' : 'DESC';

  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push('(name LIKE ? OR series LIKE ? OR character LIKE ? OR tags LIKE ? OR notes LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (type) { where.push('type = ?'); params.push(type); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (boxId) { where.push('box_id = ?'); params.push(Number(boxId)); }
  if (barcode) { where.push('barcode = ?'); params.push(barcode); }

  const sql = `SELECT * FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${sort === 'price' ? `(price IS NULL), price ${order}` : `created_at ${order}, id ${order}`} LIMIT 500`;
  const rows = await query<ItemRow>(c.env.DB, sql, ...params);

  const items = await Promise.all(rows.map(async (item) => {
    const [images, box] = await Promise.all([
      loadImages(c.env.DB, item.id),
      item.box_id
        ? one(c.env.DB, 'SELECT id, code, name, location, color FROM boxes WHERE id = ?', item.box_id)
        : Promise.resolve(null),
    ]);
    return serializeItem(item, images, box);
  }));
  return c.json({ items });
});

itemsRoutes.get('/:id', async (c) => {
  const item = await fullItem(c.env, Number(c.req.param('id')));
  if (!item) return c.json({ error: '藏品不存在' }, 404);
  const history = await query(
    c.env.DB, 'SELECT id, action, hash, nonce, created_at FROM blocks WHERE item_id = ? ORDER BY id ASC', item.id,
  );
  return c.json({ item: { ...item, history } });
});

itemsRoutes.post('/', requireWriteAuth, async (c) => {
  const input = await parseItemInput(c);
  if (!input.name) return c.json({ error: '名称不能为空' }, 400);
  const item = await createItem(c.env, input);
  return c.json({ item: await fullItem(c.env, item.id) }, 201);
});

itemsRoutes.patch('/:id', requireWriteAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const input = await parseItemInput(c);
  if (!input.name) return c.json({ error: '名称不能为空' }, 400);
  const item = await updateItem(c.env, id, input);
  if (!item) return c.json({ error: '藏品不存在' }, 404);
  return c.json({ item: await fullItem(c.env, id) });
});

itemsRoutes.delete('/:id', requireWriteAuth, async (c) => {
  const ok = await deleteItem(c.env, Number(c.req.param('id')));
  if (!ok) return c.json({ error: '藏品不存在' }, 404);
  await c.env.DB.prepare('DELETE FROM images WHERE item_id IS NULL').run();
  return c.json({ ok: true });
});
