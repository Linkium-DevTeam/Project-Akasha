import { useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BadgeCheck, Boxes, Gem, MapPin, Pencil, Package, ScrollText, Trash2 } from 'lucide-react';
import { api } from '../api';
import { fmtDate, fmtMoney, fmtTime, shortHash } from '../hooks';
import { ACTION_LABEL, CONDITION_LABEL, STATUS_LABEL, TYPE_LABEL } from '../types';
import ParallaxImage from '../components/ParallaxImage';
import ItemForm, { type ItemFormInitial } from '../components/ItemForm';
import { EmptyState, Spinner, Tag, useToast } from '../components/ui';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);

  const query = useQuery({ queryKey: ['item', id], queryFn: () => api.items.get(id!) });

  const remove = useMutation({
    mutationFn: () => api.items.remove(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries();
      toast('藏品已注销 · RETIRE 区块已封存', 'ok');
      navigate('/');
    },
    onError: (e: Error) => toast(e.message, 'err'),
  });

  if (query.isLoading) return <div className="flex justify-center py-24"><Spinner className="size-8" /></div>;
  if (query.isError || !query.data?.item) {
    return <EmptyState icon={<Gem size={26} />} title="找不到这件藏品" hint={query.isError ? String(query.error) : '可能已被注销。'} />;
  }

  const item = query.data.item;
  const img = item.images[0];
  const accent = img?.palette?.[0] ?? '#5f78f0';
  const formInitial: ItemFormInitial = { ...item, tags: item.tags };

  return (
    <div className="space-y-5" style={{ '--accent': accent } as React.CSSProperties}>
      <div className="no-print flex items-center justify-between">
        <button onClick={() => history.back()} className="glass flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:text-aether-700">
          ← 返回
        </button>
        <div className="flex gap-2">
          <Link
            to={`/cert/${item.id}`}
            className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-aether-700 transition hover:brightness-105"
          >
            <BadgeCheck size={14} /> 确权证书
          </Link>
          <button onClick={() => setFormOpen(true)} className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:text-aether-700">
            <Pencil size={14} /> 编辑
          </button>
          <button
            onClick={() => { if (confirm(`确定注销「${item.name}」？此操作会写入链上 RETIRE 区块。`)) remove.mutate(); }}
            className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-rose-400 transition hover:text-rose-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 左：视差挂件 */}
        <div className="glass overflow-hidden rounded-3xl">
          {img ? (
            <ParallaxImage
              src={img.url}
              alt={item.name}
              accent={accent}
              badges={[TYPE_LABEL[item.type], STATUS_LABEL[item.status]]}
            />
          ) : (
            <div className="flex h-72 items-center justify-center text-6xl">💠</div>
          )}
          {img && img.palette.length > 0 && (
            <div className="flex items-center gap-2 border-t border-white/50 px-4 py-3">
              <span className="text-[10px] font-bold text-ink-400">MATERIAL PALETTE</span>
              <div className="flex gap-1.5">
                {img.palette.map((c) => (
                  <button
                    key={c} title={c}
                    onClick={() => { navigator.clipboard?.writeText(c); toast(`已复制 ${c}`, 'ok'); }}
                    className="size-5 rounded-full ring-1 ring-black/10 transition hover:scale-125"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span className="ml-auto font-mono text-[10px] text-ink-400">{img.width}×{img.height} · WebP</span>
            </div>
          )}
        </div>

        {/* 右：信息 */}
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag>{TYPE_LABEL[item.type]}</Tag>
              <Tag color={item.status === 'wished' ? '#ec4899' : item.status === 'sold' ? '#64748b' : '#10b981'}>{STATUS_LABEL[item.status]}</Tag>
              <Tag color="#f59e0b">{CONDITION_LABEL[item.condition]}</Tag>
            </div>
            <h1 className="mt-2.5 text-2xl font-black leading-snug">{item.name}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {item.series && <span>{item.series}</span>}
              {item.character && <span className="ml-2 text-ink-400">◈ {item.character}</span>}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-white/50 px-3 py-2.5">
                <dt className="text-[10px] font-bold text-ink-400">价格</dt>
                <dd className="font-black">{fmtMoney(item.price, item.currency)}</dd>
              </div>
              <div className="rounded-2xl bg-white/50 px-3 py-2.5">
                <dt className="text-[10px] font-bold text-ink-400">购入</dt>
                <dd className="font-bold">{fmtDate(item.purchasedAt)}</dd>
              </div>
              <div className="rounded-2xl bg-white/50 px-3 py-2.5">
                <dt className="text-[10px] font-bold text-ink-400">收录</dt>
                <dd className="font-bold">{fmtDate(item.createdAt)}</dd>
              </div>
            </dl>

            {item.barcode && (
              <p className="mt-3 font-mono text-[11px] text-ink-400">条形码 {item.barcode}</p>
            )}
            {item.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.tags.map((t) => <span key={t} className="rounded-lg bg-aether-500/10 px-2 py-0.5 text-[11px] font-semibold text-aether-700">#{t}</span>)}
              </div>
            )}
            {item.notes && <p className="mt-3 rounded-2xl bg-white/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">{item.notes}</p>}
          </div>

          {/* 所在盒子 */}
          <Link to={item.box ? `/boxes/${item.box.id}` : '/boxes'} className="glass flex items-center gap-3.5 rounded-3xl p-4 transition hover:brightness-105">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${item.box?.color ?? '#5f78f0'}, ${accent})` }}
            >
              {item.box ? <Boxes size={20} /> : <Package size={20} />}
            </span>
            {item.box ? (
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-ink-400">现在躺在</p>
                <p className="truncate text-sm font-black">{item.box.name}</p>
                <p className="flex items-center gap-1 text-[11px] text-ink-400">
                  <MapPin size={10} />
                  <span className="font-mono">{item.box.code}</span>
                  {item.box.location && <span>· {item.box.location}</span>}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-bold text-ink-400">尚未入盒</p>
                <p className="text-sm font-black text-ink-600">去收纳盒看看 →</p>
              </div>
            )}
          </Link>

          {/* 链上履历 */}
          <div className="glass rounded-3xl p-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-black text-ink-600">
              <ScrollText size={14} className="text-aether-500" /> 链上履历
              <Link to={`/cert/${item.id}`} className="ml-auto text-[11px] font-bold text-aether-600 hover:underline">查看证书 →</Link>
            </div>
            <ol className="space-y-2">
              {item.history?.length ? item.history.map((b) => (
                <li key={b.id} className="flex items-center gap-2.5 text-[11px]">
                  <span className="w-7 shrink-0 text-right font-mono text-ink-400">#{b.id}</span>
                  <Tag color={b.action === 'REGISTER' ? '#10b981' : b.action === 'MOVE' ? '#f59e0b' : '#5f78f0'}>{ACTION_LABEL[b.action as keyof typeof ACTION_LABEL] ?? b.action}</Tag>
                  <span className="font-mono text-ink-400">{shortHash(b.hash)}</span>
                  <span className="ml-auto shrink-0 text-ink-400">{fmtTime(b.created_at)}</span>
                </li>
              )) : <li className="text-xs text-ink-400">没有链上记录。</li>}
            </ol>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {formOpen && <ItemForm open={formOpen} onClose={() => setFormOpen(false)} initial={formInitial} />}
      </AnimatePresence>
    </div>
  );
}
