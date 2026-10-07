import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../api';
import { fmtTime, shortHash } from '../hooks';
import { ACTION_LABEL, type Block } from '../types';
import { EmptyState, Spinner, Tag } from '../components/ui';

const ACTION_COLOR: Record<Block['action'], string> = {
  GENESIS: '#8b5cf6', REGISTER: '#10b981', UPDATE: '#5f78f0', MOVE: '#f59e0b', RETIRE: '#64748b',
};

export default function ChainPage() {
  const query = useQuery({ queryKey: ['chain'], queryFn: api.chain.list, refetchInterval: 30_000 });

  if (query.isLoading) return <div className="flex justify-center py-24"><Spinner className="size-8" /></div>;
  const { blocks, verification, difficulty } = query.data!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          <span className="text-gradient">The Ledger</span>
          <span className="ml-2 align-middle text-sm font-bold text-ink-400">链账本</span>
        </h1>
        <p className="mt-1 text-xs text-ink-400">
          每一次收录、修改、移库都被封进带工作量证明的区块 —— 任何一页被篡改，整条链都会发出警报。
        </p>
      </div>

      {/* 校验横幅 */}
      <div className={`glass flex flex-wrap items-center gap-3 rounded-3xl px-5 py-4 ${verification.valid ? '' : 'ring-2 ring-rose-300'}`}>
        {verification.valid
          ? <ShieldCheck size={26} className="text-emerald-500" />
          : <ShieldX size={26} className="text-rose-500" />}
        <div>
          <p className="text-sm font-black">
            {verification.valid ? '全链校验通过' : `警告：区块 #${verification.brokenAt} 之后链已损坏`}
          </p>
          <p className="text-[11px] text-ink-400">
            {verification.count} 个区块 · PoW 难度 {difficulty}（哈希前导 {difficulty} 个 0）· SHA-256
          </p>
        </div>
        <p className="ml-auto font-mono text-[10px] text-ink-400">每 30 秒自动复核</p>
      </div>

      {blocks.length === 0 ? (
        <EmptyState icon={<ScrollText size={26} />} title="链是空的" hint="收录第一件藏品后，创世区块会自动生成。" />
      ) : (
        <ol className="relative space-y-2.5">
          {blocks.map((b, i) => {
            const payload = (() => { try { return JSON.parse(b.payload); } catch { return {}; } })();
            const color = ACTION_COLOR[b.action] ?? '#5f78f0';
            const body = (
              <motion.li
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className="glass flex items-center gap-3 rounded-2xl px-4 py-3"
              >
                <span className="w-9 shrink-0 text-right font-mono text-xs font-bold text-ink-400">#{b.id}</span>
                <span
                  className="w-14 shrink-0 rounded-lg py-1 text-center text-[11px] font-black"
                  style={{ background: `${color}1a`, color }}
                >
                  {ACTION_LABEL[b.action] ?? b.action}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {b.item_name ?? payload?.name ?? (b.action === 'GENESIS' ? payload?.message : payload?.retired?.name) ?? '—'}
                  </span>
                  <span className="font-mono text-[10px] text-ink-400">
                    {shortHash(b.prev_hash, 8, 4)} → {shortHash(b.hash, 8, 4)}
                  </span>
                </span>
                <span className="hidden shrink-0 text-right text-[10px] text-ink-400 sm:block">
                  <span className="block">nonce {b.nonce.toLocaleString()}</span>
                  <span>{fmtTime(b.created_at)}</span>
                </span>
              </motion.li>
            );
            return b.item_id && b.action !== 'RETIRE'
              ? <Link key={b.id} to={`/items/${b.item_id}`} className="block">{body}</Link>
              : <div key={b.id}>{body}</div>;
          })}
        </ol>
      )}
    </div>
  );
}
