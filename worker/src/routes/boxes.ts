import { Hono, type Context } from 'hono';
import { one, query, run } from '../db.js';
import { writeGate } from '../gate.js';
import { createBox, BoxCodeError, type BoxInput } from '../services.js';

export interface BoxRow {
  id: number; code: string; name: string; location: string; capacity: number;
  color: string; secret: string; created_at: string;
}

/** 批量统计各盒子藏品数（D1 batch 单次往返，每条均为静态参数化 SQL） */
async function countsByBoxId(db: D1Database, boxIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (boxIds.length === 0) return map;
  const stmts = boxIds.map((id) =>
    db.prepare('SELECT COUNT(*) AS c FROM items WHERE box_id = ?').bind(id),
  );
  const results = await db.batch(stmts);
  boxIds.forEach((id, i) => {
    const row = results[i]?.results[0] as { c: number } | undefined;
    map.set(id, row?.c ?? 0);
  });
  return map;
}

export async function serializeBox(
  db: D1Database, box: BoxRow,
  opts: { reveal?: boolean; withItems?: boolean; counts?: Map<number, number> } = {},
) {
  let count: number;
  if (opts.counts) {
    count = opts.counts.get(box.id) ?? 0;
  } else {
    count = (await one<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM items WHERE box_id = ?', box.id))!.c;
  }
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

type Ctx = Context<{ Bindings: Env }>;

const parseBoxInput = async (c: Ctx): Promise<BoxInput> => {
  const b = await c.req.json();
  return {
    name: String(b.name ?? '').trim(),
    // 仅创建时生效；PATCH 不改盒码（避免已贴二维码 / NFC 标签失效）
    code: String(b.code ?? ''),
    location: String(b.location ?? '').trim(),
    capacity: Number(b.capacity ?? 0),
    color: String(b.color ?? '#5f78f0'),
    secret: String(b.secret ?? ''),
  };
};

export const boxesRoutes = new Hono<{ Bindings: Env }>();

// 写操作只允许经 /api/write/* 通道（受 Cloudflare Access 保护）
boxesRoutes.use('*', writeGate);

boxesRoutes.get('/', async (c) => {
  const rows = await query<BoxRow>(c.env.DB, 'SELECT * FROM boxes ORDER BY created_at DESC, id DESC');
  const counts = await countsByBoxId(c.env.DB, rows.map((b) => b.id));
  const boxes = await Promise.all(rows.map((b) => serializeBox(c.env.DB, b, { counts })));
  return c.json({ boxes });
});

boxesRoutes.get('/:id', async (c) => {
  const reveal = c.req.query('reveal') === '1';
  const box = await one<BoxRow>(c.env.DB, 'SELECT * FROM boxes WHERE id = ?', Number(c.req.param('id')));
  if (!box) return c.json({ error: '盒子不存在' }, 404);
  return c.json({ box: await serializeBox(c.env.DB, box, { reveal, withItems: true }) });
});

boxesRoutes.post('/', async (c) => {
  const input = await parseBoxInput(c);
  if (!input.name) return c.json({ error: '名称不能为空' }, 400);
  try {
    const box = await createBox(c.env, input);
    return c.json({ box: await serializeBox(c.env.DB, box as BoxRow) }, 201);
  } catch (e) {
    if (e instanceof BoxCodeError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

boxesRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const input = await parseBoxInput(c);
  if (!input.name) return c.json({ error: '名称不能为空' }, 400);
  const exists = await one<BoxRow>(c.env.DB, 'SELECT * FROM boxes WHERE id = ?', id);
  if (!exists) return c.json({ error: '盒子不存在' }, 404);
  await run(c.env.DB, 'UPDATE boxes SET name = ?, location = ?, capacity = ?, color = ?, secret = ? WHERE id = ?',
    input.name, input.location, Math.max(0, Math.floor(input.capacity ?? 0)), input.color, input.secret, id);
  return c.json({ box: await serializeBox(c.env.DB, (await one<BoxRow>(c.env.DB, 'SELECT * FROM boxes WHERE id = ?', id))!) });
});

boxesRoutes.delete('/:id', async (c) => {
  const { changes } = await run(c.env.DB, 'DELETE FROM boxes WHERE id = ?', Number(c.req.param('id')));
  if (!changes) return c.json({ error: '盒子不存在' }, 404);
  return c.json({ ok: true });
});
