import { now } from './db.js';
import { sha256 } from './sha256.js';
import type { Env } from './env.js';

export interface Block {
  id: number;
  item_id: number | null;
  action: string;
  payload: string;
  prev_hash: string;
  hash: string;
  nonce: number;
  difficulty: number;
  created_at: string;
}

export interface BlockCore {
  prev_hash: string;
  item_id: number | null;
  action: string;
  payload: string;
  created_at: string;
  nonce: number;
}

export const blockHash = (b: BlockCore) =>
  sha256(`${b.prev_hash}|${b.item_id ?? ''}|${b.action}|${b.payload}|${b.created_at}|${b.nonce}`);

export const difficultyOf = (env: Env) => Math.max(1, Math.min(6, Number(env.CHAIN_DIFFICULTY ?? 2) || 2));

/** 轻量工作量证明：找到使哈希以 N 个 0 开头的 nonce（难度记录进区块，跨环境可校验） */
export function mine(prevHash: string, itemId: number | null, action: string, payload: string, createdAt: string, difficulty: number) {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  let hash = '';
  do {
    hash = blockHash({ prev_hash: prevHash, item_id: itemId, action, payload, created_at: createdAt, nonce });
    nonce++;
  } while (!hash.startsWith(prefix));
  return { hash, nonce: nonce - 1 };
}

export async function appendBlock(env: Env, action: string, itemId: number | null, payload: unknown): Promise<Block> {
  await ensureGenesis(env);
  const prev = await env.DB.prepare('SELECT hash FROM blocks ORDER BY id DESC LIMIT 1').first<{ hash: string }>();
  const prevHash = prev?.hash ?? '0'.repeat(64);
  const ts = now();
  const payloadText = JSON.stringify(payload ?? {});
  const difficulty = difficultyOf(env);
  const { hash, nonce } = mine(prevHash, itemId, action, payloadText, ts, difficulty);
  const res = await env.DB.prepare(
    'INSERT INTO blocks (item_id, action, payload, prev_hash, hash, nonce, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(itemId, action, payloadText, prevHash, hash, nonce, difficulty, ts).run();
  return {
    id: Number(res.meta.last_row_id), item_id: itemId, action, payload: payloadText,
    prev_hash: prevHash, hash, nonce, difficulty, created_at: ts,
  };
}

/** 创世区块：首次使用时写入（幂等） */
export async function ensureGenesis(env: Env) {
  const exists = await env.DB.prepare('SELECT id FROM blocks LIMIT 1').first();
  if (exists) return;
  const ts = now();
  const payload = JSON.stringify({ born: ts, message: 'Akasha Void Archive — 从虚无中诞生的第一块记忆晶石' });
  const difficulty = difficultyOf(env);
  const { hash, nonce } = mine('0'.repeat(64), null, 'GENESIS', payload, ts, difficulty);
  await env.DB.prepare(
    'INSERT INTO blocks (item_id, action, payload, prev_hash, hash, nonce, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(null, 'GENESIS', payload, '0'.repeat(64), hash, nonce, difficulty, ts).run();
}

export async function verifyChain(env: Env): Promise<{ valid: boolean; count: number; brokenAt: number | null }> {
  const { results } = await env.DB.prepare('SELECT * FROM blocks ORDER BY id ASC').all<Block>();
  let prevHash = '0'.repeat(64);
  for (const b of results) {
    if (b.prev_hash !== prevHash || blockHash(b) !== b.hash || !b.hash.startsWith('0'.repeat(b.difficulty))) {
      return { valid: false, count: results.length, brokenAt: b.id };
    }
    prevHash = b.hash;
  }
  return { valid: true, count: results.length, brokenAt: null };
}
