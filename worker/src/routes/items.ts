import { Hono, type Context } from 'hono';
import { one, query } from '../db.js';
import { requireWriteAuth } from '../auth.js';
import { createItem, updateItem, deleteItem, type ItemInput } from '../services.js';

export interface ItemRow {
  id: number; name: string; series: string; character: string; type: string; status: string;
  condition: string; price: number | null; currency: string; purchased_at: string; notes: string;
  barcode: string; tags: string; box_id: number | null; created_at: string; updated_at: string;
}

interface ImageRow {
  id: number; item_id: number | null; file: string; thumb: string;
  width: number; height: number; palette: string; sort: number; created_at: string;
}

interface BoxBriefRow { id: number; code: string; name: string; location: string; color: string }

function serializeImage(img: ImageRow) {
  return {
    id: img.id,
    url: `/images/${img.file}`,
    thumbUrl: `/images/${img.thumb}`,
    width: img.width,
    height: img.height,
    palette: JSON.parse(img.palette || '[]') as string[],
  };
}

function serializeItem(item: ItemRow, images: ImageRow[], box: BoxBriefRow | null) {
  return {
    id: item.id, name: item.name, series: item.series, character: item.character,
    type: item.type, status: item.status, condition: item.condition,
    price: item.price, currency: item.currency,
    purchasedAt: item.purchased_at, notes: item.notes, barcode: item.barcode,
    tags: item.tags ? item.tags.split(',').filter(Boolean) : [],
    boxId: item.box_id, box, images: images.map(serializeImage),
    createdAt: item.created_at, updatedAt: item.updated_at,
  };
}

/** 批量取图片与盒子摘要，避免逐行 N+1 查询 */
async function attachImagesAndBoxes(db: D1Database, items: ItemRow[]) {
  const itemIds = items.map((i) => i.id);
  const boxIds = [...new Set(items.map((i) => i.box_id).filter((v): v is number => v != null))];
  if (itemIds.length === 0) return [];

  const ph = (n: number) => n > 0 ? `(${Array.from({ length: n }, () => '?').join(',')})` : '(NULL)';
  const [imageRows, boxRows] = await Promise.all([
    itemIds.length
      ? query<ImageRow>(db, `SELECT * FROM images WHERE item_id IN ${ph(itemIds.length)} ORDER BY sort ASC, id ASC`, ...itemIds)
      : Promise.resolve([] as ImageRow[]),
    boxIds.length
      ? query<BoxBriefRow>(db, `SELECT id, code, name, location, color FROM boxes WHERE id IN ${ph(boxIds.length)}`, ...boxIds)
      : Promise.resolve([] as BoxBriefRow[]),
  ]);

  const imagesByItem = new Map<number, ImageRow[]>();
  for (const img of imageRows) {
    const list = imagesByItem.get(img.item_id!) ?? [];
    list.push(img);
    imagesByItem.set(img.item_id!, list);
  }
  const boxesById = new Map(boxRows.map((b) => [b.id, b]));

  return items.map((item) =>
    serializeItem(item, imagesByItem.get(item.id) ?? [], item.box_id ? boxesById.get(item.box_id) ?? null : null),
  );
}

async function fullItem(env: { DB: D1Database }, id: number) {
  const item = await one<ItemRow>(env.DB, 'SELECT * FROM items WHERE id = ?', id);
  if (!item) return undefined;
  const [attached] = await attachImagesAndBoxes(env.DB, [item]);
  return attached;
}

type Ctx = Context<{ Bindings: Env }>;

const parseItemInput = async (c: Ctx): Promise<ItemInput> => {
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
  return c.json({ items: await attachImagesAndBoxes(c.env.DB, rows) });
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
