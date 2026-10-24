import { appendBlock } from './chain.js';
import { now } from './db.js';

export interface ItemInput {
  name: string;
  series?: string;
  character?: string;
  type?: string;
  status?: string;
  condition?: string;
  price?: number | null;
  currency?: string;
  purchasedAt?: string;
  notes?: string;
  barcode?: string;
  tags?: string[];
  boxId?: number | null;
  imageIds?: number[];
}

export interface BoxInput {
  name: string;
  /** 可选：录入已有盒码；留空则自动生成 AKS-XXXX */
  code?: string;
  location?: string;
  capacity?: number;
  color?: string;
  secret?: string;
}

/** 自定义盒码规则：2-16 位字母 / 数字 / 连字符，入库前统一大写 */
const CUSTOM_CODE_RE = /^[A-Z0-9-]{2,16}$/;

/** 盒码不可用（格式错误或已被占用） */
export class BoxCodeError extends Error {
  status: 400 | 409;
  constructor(message: string, status: 400 | 409 = 400) {
    super(message);
    this.status = status;
  }
}

const BOX_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export async function generateBoxCode(db: D1Database): Promise<string> {
  let code: string;
  do {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    code = 'AKS-' + [...bytes].map((b) => BOX_ALPHABET[b % BOX_ALPHABET.length]).join('');
  } while (await db.prepare('SELECT id FROM boxes WHERE code = ?').bind(code).first());
  return code;
}

const itemSnapshot = (item: Record<string, any>, boxCode: string | null, imageCount: number) => ({
  name: item.name,
  series: item.series,
  character: item.character,
  type: item.type,
  status: item.status,
  condition: item.condition,
  price: item.price ?? null,
  currency: item.currency,
  box: boxCode,
  images: imageCount,
});

async function linkImages(db: D1Database, itemId: number, imageIds: number[]) {
  for (let i = 0; i < imageIds.length; i++) {
    await db.prepare('UPDATE images SET item_id = ?, sort = ? WHERE id = ? AND (item_id IS NULL OR item_id = ?)')
      .bind(itemId, i, imageIds[i], itemId).run();
  }
}

export async function createItem(env: Env, input: ItemInput): Promise<Record<string, any>> {
  const ts = now();
  const res = await env.DB.prepare(
    `INSERT INTO items (name, series, character, type, status, condition, price, currency, purchased_at, notes, barcode, tags, box_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    input.name,
    input.series ?? '', input.character ?? '', input.type ?? 'badge',
    input.status ?? 'owned', input.condition ?? 'mint',
    input.price ?? null, input.currency ?? 'CNY',
    input.purchasedAt ?? '', input.notes ?? '', input.barcode ?? '',
    (input.tags ?? []).join(','), input.boxId ?? null, ts, ts,
  ).run();
  const id = Number(res.meta.last_row_id);
  await linkImages(env.DB, id, input.imageIds ?? []);

  const item = await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Record<string, any>>();
  const box = input.boxId
    ? await env.DB.prepare('SELECT code FROM boxes WHERE id = ?').bind(input.boxId).first<{ code: string }>()
    : null;
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM images WHERE item_id = ?').bind(id).first<{ c: number }>();
  await appendBlock(env, 'REGISTER', id, itemSnapshot(item!, box?.code ?? null, count!.c));
  return item!;
}

export async function updateItem(env: Env, id: number, input: ItemInput): Promise<Record<string, any> | undefined> {
  const prev = await env.DB.prepare('SELECT box_id FROM items WHERE id = ?').bind(id).first<{ box_id: number | null }>();
  if (!prev) return undefined;
  await env.DB.prepare(
    `UPDATE items SET name = ?, series = ?, character = ?, type = ?, status = ?, condition = ?, price = ?, currency = ?,
     purchased_at = ?, notes = ?, barcode = ?, tags = ?, box_id = ?, updated_at = ? WHERE id = ?`,
  ).bind(
    input.name,
    input.series ?? '', input.character ?? '', input.type ?? 'badge',
    input.status ?? 'owned', input.condition ?? 'mint',
    input.price ?? null, input.currency ?? 'CNY',
    input.purchasedAt ?? '', input.notes ?? '', input.barcode ?? '',
    (input.tags ?? []).join(','), input.boxId ?? null, now(), id,
  ).run();
  await linkImages(env.DB, id, input.imageIds ?? []);

  const item = await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Record<string, any>>();
  const box = input.boxId
    ? await env.DB.prepare('SELECT code FROM boxes WHERE id = ?').bind(input.boxId).first<{ code: string }>()
    : null;
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM images WHERE item_id = ?').bind(id).first<{ c: number }>();
  const moved = (prev.box_id ?? null) !== (input.boxId ?? null);
  await appendBlock(env, moved ? 'MOVE' : 'UPDATE', id, itemSnapshot(item!, box?.code ?? null, count!.c));
  return item!;
}

export async function deleteItem(env: Env, id: number): Promise<boolean> {
  const item = await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Record<string, any>>();
  if (!item) return false;
  const box = item.box_id
    ? await env.DB.prepare('SELECT code FROM boxes WHERE id = ?').bind(item.box_id).first<{ code: string }>()
    : null;
  const { results: images } = await env.DB.prepare('SELECT file, thumb FROM images WHERE item_id = ?').bind(id).all<{ file: string; thumb: string }>();
  await appendBlock(env, 'RETIRE', null, {
    retired: itemSnapshot(item, box?.code ?? null, images.length), retiredAt: now(),
  });
  await env.DB.prepare('DELETE FROM images WHERE item_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
  // 清理 R2 对象（尽力而为）
  if (images.length > 0) {
    try {
      await env.BUCKET.delete(images.flatMap((i) => [i.file, i.thumb]));
    } catch { /* 孤儿对象可在运维时清理 */ }
  }
  return true;
}

export async function createBox(env: Env, input: BoxInput): Promise<Record<string, any>> {
  // 已有盒码优先：手动录入统一大写并查重；留空走自动生成
  let code = (input.code ?? '').trim().toUpperCase();
  if (code) {
    if (!CUSTOM_CODE_RE.test(code)) {
      throw new BoxCodeError('盒码格式无效：2-16 位字母、数字或连字符', 400);
    }
    if (await env.DB.prepare('SELECT id FROM boxes WHERE code = ?').bind(code).first()) {
      throw new BoxCodeError(`盒码 ${code} 已被占用`, 409);
    }
  } else {
    code = await generateBoxCode(env.DB);
  }
  const res = await env.DB.prepare(
    'INSERT INTO boxes (code, name, location, capacity, color, secret, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    code, input.name, input.location ?? '',
    Math.max(0, Math.floor(input.capacity ?? 0)), input.color ?? '#5f78f0', input.secret ?? '', now(),
  ).run();
  return (await env.DB.prepare('SELECT * FROM boxes WHERE id = ?').bind(Number(res.meta.last_row_id)).first<Record<string, any>>())!;
}
