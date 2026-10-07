import { Hono } from 'hono';
import type { Env } from '../env.js';
import { one, query, run } from '../db.js';
import { requireWriteAuth } from '../auth.js';
import { createBox, type BoxInput } from '../services.js';

export interface BoxRow {
  id: number; code: string; name: string; location: string; capacity: number;
  color: string; secret: string; created_at: string;
}

export async function serializeBox(db: D1Database, box: BoxRow, opts: { reveal?: boolean; withItems?: boolean } = {}) {
  const count = (await one<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM items WHERE box_id = ?', box.id))!.c;
  const base: Record<string, unknown> = {
    id: box.id, code: box.code, name: box.name, location: box.location,
    capacity: box.capacity, color: box.color, count,
    hasSecret: box.secret.length > 0, createdAt: box.created_at,
  };
  if (opts.reveal) base.secret = box.secret;
  if (opts.withItems) {
    const rows = await query<{ id: number }>(db, 'SELECT id FROM items WHERE box_id = ? ORDER BY created_at DESC, id DESC', box.id);
    base.items = rows.map((r) => r.id);
  }
  return base;
}

const parseBoxInput = async (c: any): Promise<BoxInput> => {
  const b = await c.req.json();
  return {
    name: String(b.name ?? '').trim(),
    location: String(b.location ?? '').trim(),
    capacity: Number(b.capacity ?? 0),
    color: String(b.color ?? '#5f78f0'),
    secret: String(b.secret ?? ''),
  };
};

export const boxesRoutes = new Hono<{ Bindings: Env }>();

boxesRoutes.get('/', async (c) => {
  const rows = await query<BoxRow>(c.env.DB, 'SELECT * FROM boxes ORDER BY created_at DESC, id DESC');
  return c.json({ boxes: await Promise.all(rows.map((b) => serializeBox(c.env.DB, b))) });
});

boxesRoutes.get('/:id', async (c) => {
  const reveal = c.req.query('reveal') === '1';
  const box = await one<BoxRow>(c.env.DB, 'SELECT * FROM boxes WHERE id = ?', Number(c.req.param('id')));
  if (!box) return c.json({ error: '盒子不存在' }, 404);
  return c.json({ box: await serializeBox(c.env.DB, box, { reveal, withItems: true }) });
});

boxesRoutes.post('/', requireWriteAuth, async (c) => {
  const input = await parseBoxInput(c);
  if (!input.name) return c.json({ error: '名称不能为空' }, 400);
  const box = await createBox(c.env, input);
  return c.json({ box: await serializeBox(c.env.DB, box as BoxRow) }, 201);
});

boxesRoutes.patch('/:id', requireWriteAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const input = await parseBoxInput(c);
  if (!input.name) return c.json({ error: '名称不能为空' }, 400);
  const exists = await one<BoxRow>(c.env.DB, 'SELECT * FROM boxes WHERE id = ?', id);
  if (!exists) return c.json({ error: '盒子不存在' }, 404);
  await run(c.env.DB, 'UPDATE boxes SET name = ?, location = ?, capacity = ?, color = ?, secret = ? WHERE id = ?',
    input.name, input.location, Math.max(0, Math.floor(input.capacity ?? 0)), input.color, input.secret, id);
  return c.json({ box: await serializeBox(c.env.DB, (await one<BoxRow>(c.env.DB, 'SELECT * FROM boxes WHERE id = ?', id))!) });
});

boxesRoutes.delete('/:id', requireWriteAuth, async (c) => {
  const { changes } = await run(c.env.DB, 'DELETE FROM boxes WHERE id = ?', Number(c.req.param('id')));
  if (!changes) return c.json({ error: '盒子不存在' }, 404);
  return c.json({ ok: true });
});
