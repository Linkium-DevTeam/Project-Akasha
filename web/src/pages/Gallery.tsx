import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Gem, Plus, Search, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useDebounced, fmtMoney } from '../hooks';
import type { ItemType, ItemStatus } from '../types';
import { TYPE_LABEL } from '../types';
import ItemCard from '../components/ItemCard';
import Masonry from '../components/Masonry';
import ItemForm, { type ItemFormInitial } from '../components/ItemForm';
import { Chip, EmptyState, Spinner, useToast } from '../components/ui';
import { seedDemoData } from '../lib/seed';

const TYPES: Array<ItemType | ''> = ['', 'badge', 'standee', 'acrylic', 'plush', 'card', 'other'];
const STATUSES: Array<{ v: ItemStatus | ''; label: string }> = [
  { v: '', label: '全部' }, { v: 'owned', label: '拥有' }, { v: 'ordered', label: '已预订' }, { v: 'wished', label: '心愿单' },
];

export default function Gallery() {
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<ItemFormInitial | undefined>();
  const qc = useQueryClient();
  const toast = useToast();

  const q = params.get('q') ?? '';
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const sort = params.get('sort') ?? 'new';

  const search = useDebounced(q, 280);

  const query = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p.q = search;
    if (type) p.type = type;
    if (status) p.status = status;
    if (sort === 'price') { p.sort = 'price'; p.order = 'desc'; }
    return p;
  }, [search, type, status, sort]);

  const items = useQuery({ queryKey: ['items', query], queryFn: () => api.items.list(query) });
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });

  const seed = useMutation({
    mutationFn: seedDemoData,
    onSuccess: ({ boxes, items }) => {
      qc.invalidateQueries();
      toast(`已灌入 ${boxes} 个盒子 + ${items} 件示例藏品（链上 ${items + 1} 个区块）`, 'ok');
    },
    onError: (e: Error) => toast(e.message, 'err'),
  });

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      {/* 标题区 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            <span className="text-gradient">The Gallery</span>
            <span className="ml-2 align-middle text-sm font-bold text-ink-400">藏品馆</span>
          </h1>
          <p className="mt-1 text-xs text-ink-400">「我知道我买了这个吧唧，但它现在在哪个盒子里？」—— 从此不再是谜。</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <StatChip label="藏品" value={`${stats.data?.items ?? '—'} 件`} />
          <StatChip label="收纳盒" value={`${stats.data?.boxes ?? '—'} 个`} />
          <StatChip label="总价值" value={stats.data ? fmtMoney(stats.data.value) : '—'} />
        </div>
      </div>

      {/* 搜索 + 过滤 */}
      <div className="space-y-2.5">
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-2.5">
          <Search size={17} className="shrink-0 text-ink-400" />
          <input
            value={q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="搜索名称 / 系列 / 角色 / 标签…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
          />
          {q && <button onClick={() => set('q', '')} className="text-xs font-semibold text-ink-400 hover:text-aether-600">清除</button>}
        </div>
        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => set('type', t)}>
              {t === '' ? '全部' : TYPE_LABEL[t]}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-white/70" />
          {STATUSES.map((s) => (
            <Chip key={s.v} active={status === s.v} onClick={() => set('status', s.v)}>{s.label}</Chip>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-white/70" />
          <Chip active={sort === 'new'} onClick={() => set('sort', 'new')}>最新</Chip>
          <Chip active={sort === 'price'} onClick={() => set('sort', 'price')}>最贵</Chip>
        </div>
      </div>

      {/* 移动端统计 */}
      <div className="glass-soft flex items-center justify-between rounded-2xl px-4 py-2 text-[11px] font-semibold text-ink-600 md:hidden">
        <span>💠 {stats.data?.items ?? '—'} 件藏品</span>
        <span>📦 {stats.data?.boxes ?? '—'} 个盒子</span>
        <span>💰 {stats.data ? fmtMoney(stats.data.value) : '—'}</span>
      </div>

      {/* 瀑布流 */}
      {items.isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="size-8" /></div>
      ) : items.data?.items.length ? (
        <Masonry>
          {items.data.items.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </Masonry>
      ) : (
        <EmptyState
          icon={<Gem size={26} />}
          title="虚无档案中还没有藏品"
          hint="点击右下角 + 收录第一件谷子，或者先灌入一批示例数据把玩一下。"
          action={
            <button
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-aether-500/30 transition hover:brightness-110 disabled:opacity-50"
            >
              {seed.isPending ? <Spinner className="size-3.5 border-white/40 border-t-white" /> : <Sparkles size={14} />}
              {seed.isPending ? '正在生成示例…' : '灌入示例数据'}
            </button>
          }
        />
      )}

      {/* 悬浮添加按钮 */}
      <button
        onClick={() => { setFormInitial(undefined); setFormOpen(true); }}
        aria-label="收录新藏品"
        className="no-print fixed bottom-24 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-aether-500 via-aether-600 to-fuchsia-500 text-white shadow-xl shadow-aether-500/40 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <AnimatePresence>
        {formOpen && <ItemForm open={formOpen} onClose={() => setFormOpen(false)} initial={formInitial} />}
      </AnimatePresence>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl px-3.5 py-2">
      <Sparkles size={13} className="text-moe-400" />
      <div className="leading-tight">
        <p className="text-[10px] font-semibold text-ink-400">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  );
}
