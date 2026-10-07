import { Hono } from 'hono';
import { verifyChain } from '../chain.js';
import { sha256 } from '../sha256.js';
import { one, query } from '../db.js';
import type { Env } from '../env.js';

// 链账本：/api/chain、/api/chain/verify
export const chainRoutes = new Hono<{ Bindings: Env }>();

chainRoutes.get('/chain', async (c) => {
  const blocks = await query<Record<string, any>>(
    c.env.DB,
    `SELECT b.*, i.name AS item_name FROM blocks b
     LEFT JOIN items i ON i.id = b.item_id
     ORDER BY b.id DESC LIMIT 300`,
  );
  return c.json({ blocks, verification: await verifyChain(c.env), difficulty: Math.max(1, Number(c.env.CHAIN_DIFFICULTY ?? 2) || 2) });
});

chainRoutes.get('/chain/verify', async (c) => c.json(await verifyChain(c.env)));

// 数字确权证书：/api/cert/:itemId
export const certRoutes = new Hono<{ Bindings: Env }>();

certRoutes.get('/:itemId', async (c) => {
  const itemId = Number(c.req.param('itemId'));
  const item = await one<Record<string, any>>(c.env.DB, 'SELECT * FROM items WHERE id = ?', itemId);
  if (!item) return c.json({ error: '藏品不存在' }, 404);
  const blocks = await query<Record<string, any>>(c.env.DB, 'SELECT * FROM blocks WHERE item_id = ? ORDER BY id ASC', itemId);
  const register = blocks.find((b) => b.action === 'REGISTER');
  if (!register) return c.json({ error: '该藏品没有确权区块（可能是链重置前注册）' }, 404);
  const chain = await verifyChain(c.env);
  const firstImage = await one<{ thumb: string }>(c.env.DB, 'SELECT thumb FROM images WHERE item_id = ? ORDER BY sort ASC, id ASC LIMIT 1', itemId);

  return c.json({
    certificate: {
      certId: sha256(`${register.hash}:${itemId}:${register.created_at}`).slice(0, 16).toUpperCase()
        .replace(/(.{4})(?=.)/g, '$1-'),
      issuedAt: register.created_at,
      registerHash: register.hash,
      latestHash: blocks[blocks.length - 1].hash,
      height: register.id,
      chainHeight: (await one<{ c: number }>(c.env.DB, 'SELECT COUNT(*) AS c FROM blocks'))!.c,
      verified: chain.valid,
      item: {
        id: item.id, name: item.name, series: item.series, character: item.character,
        type: item.type, status: item.status, condition: item.condition,
        price: item.price, currency: item.currency, createdAt: item.created_at,
      },
      thumbUrl: firstImage ? `/images/${firstImage.thumb}` : null,
      history: blocks.map((b) => ({
        id: b.id, action: b.action, hash: b.hash, nonce: b.nonce, createdAt: b.created_at,
      })),
    },
  });
});
