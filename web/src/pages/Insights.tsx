import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BadgeCheck, ChartPie, ScrollText } from 'lucide-react';
import { api } from '../api';
import { fmtMoney } from '../hooks';
import { STATUS_LABEL, TYPE_LABEL, type Item, type ItemType } from '../types';
import { Spinner } from '../components/ui';

const TYPE_COLORS: Record<string, string> = {
  badge: '#5f78f0', standee: '#e860a8', acrylic: '#0ea5b7',
  plush: '#f59e0b', card: '#8b5cf6', other: '#64748b',
};

export default function Insights() {
  const items = useQuery({ queryKey: ['items', 'insights'], queryFn: () => api.items.list({}) });
  const chain = useQuery({ queryKey: ['chainVerify'], queryFn: api.chain.verify });

  const data = useMemo(() => {
    const list: Item[] = items.data?.items ?? [];
    const owned = list.filter((i) => i.status !== 'wished');
    const byType = new Map<ItemType, { count: number; value: number }>();
    const byStatus = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const bySeries = new Map<string, { count: number; value: number }>();

    for (const it of list) {
      byType.set(it.type, (byType.get(it.type) ?? { count: 0, value: 0 }));
      const t = byType.get(it.type)!;
      t.count++;
      t.value += it.price ?? 0;
      byStatus.set(it.status, (byStatus.get(it.status) ?? 0) + 1);

      const month = (it.purchasedAt || it.createdAt).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) byMonth.set(month, (byMonth.get(month) ?? 0) + 1);

      const key = it.series || '未填写系列';
      const s = bySeries.get(key) ?? { count: 0, value: 0 };
      s.count++;
      s.value += it.price ?? 0;
      bySeries.set(key, s);
    }

    const months: Array<{ month: string; count: number }> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: m, count: byMonth.get(m) ?? 0 });
    }

    const totalValue = owned.reduce((s, i) => s + (i.price ?? 0), 0);
    return {
      total: list.length,
      totalValue,
      avg: owned.length ? totalValue / owned.length : 0,
      types: [...byType.entries()].sort((a, b) => b[1].count - a[1].count),
      statuses: [...byStatus.entries()],
      months,
      series: [...bySeries.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 6),
      images: list.reduce((s, i) => s + i.images.length, 0),
    };
  }, [items.data]);

  if (items.isLoading) return <div className="flex justify-center py-24"><Spinner className="size-8" /></div>;

  const maxMonth = Math.max(1, ...data.months.map((m) => m.count));
  const maxType = Math.max(1, ...(data.types.map(([, v]) => v.count) ?? [1]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          <span className="text-gradient">Insights</span>
          <span className="ml-2 align-middle text-sm font-bold text-ink-400">数据洞察</span>
        </h1>
        <p className="mt-1 text-xs text-ink-400">你的收藏正在讲述一个什么样的故事。</p>
      </div>

      {/* 总览 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Overview label="藏品总数" value={`${data.total} 件`} sub={`照片 ${data.images} 张`} />
        <Overview label="总价值" value={fmtMoney(data.totalValue)} sub="已拥有部分" accent />
        <Overview label="单件均价" value={fmtMoney(Math.round(data.avg * 100) / 100)} sub="按已拥有" />
        <Overview label="链上区块" value={`${chain.data?.count ?? '—'} 块`} sub={chain.data?.valid ? '校验有效' : '校验异常'}
          action={<Link to="/chain" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-aether-600 hover:underline"><ScrollText size={10} /> 查看账本</Link>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 类型分布 */}
        <section className="glass rounded-3xl p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-ink-600"><ChartPie size={14} className="text-aether-500" /> 类型分布</h2>
          <div className="mt-4 space-y-3">
            {data.types.map(([type, v], i) => (
              <div key={type}>
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="font-bold text-ink-600">{TYPE_LABEL[type] ?? type}</span>
                  <span className="font-mono text-ink-400">{v.count} 件 · {fmtMoney(v.value)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/5">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${(v.count / maxType) * 100}%` }}
                    transition={{ delay: i * 0.06, duration: 0.6, ease: 'easeOut' }}
                    style={{ background: `linear-gradient(90deg, ${TYPE_COLORS[type] ?? '#5f78f0'}, ${TYPE_COLORS[type] ?? '#5f78f0'}99)` }}
                  />
                </div>
              </div>
            ))}
            {data.types.length === 0 && <p className="text-xs text-ink-400">还没有数据。</p>}
          </div>
        </section>

        {/* 月度趋势 */}
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-black text-ink-600">近 12 个月收录趋势</h2>
          <div className="mt-4 flex h-36 items-end gap-1.5">
            {data.months.map((m, i) => (
              <div key={m.month} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-aether-600 opacity-0 transition group-hover:opacity-100">{m.count}</span>
                <motion.div
                  className="w-full rounded-t-lg bg-gradient-to-t from-aether-500/70 to-fuchsia-400/80"
                  initial={{ height: 0 }} animate={{ height: `${Math.max(4, (m.count / maxMonth) * 100)}%` }}
                  transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                  title={`${m.month} · ${m.count} 件`}
                />
                <span className="w-full truncate text-center text-[8px] text-ink-400">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 系列 Top */}
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-black text-ink-600">系列价值 Top 6</h2>
          <div className="mt-4 space-y-2.5">
            {data.series.map(([name, v], i) => (
              <div key={name} className="flex items-center gap-2.5 text-xs">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white ${i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-black/10 text-ink-600'}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold text-ink-600">{name}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-400">{v.count} 件</span>
                <span className="w-20 shrink-0 text-right font-black text-aether-700">{fmtMoney(v.value)}</span>
              </div>
            ))}
            {data.series.length === 0 && <p className="text-xs text-ink-400">还没有数据。</p>}
          </div>
        </section>

        {/* 状态分布 */}
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-black text-ink-600">状态构成</h2>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full">
            {data.statuses.map(([status, count]) => {
              const colors: Record<string, string> = {
                owned: 'linear-gradient(90deg,#5f78f0,#819af8)', wished: '#f178b8',
                ordered: '#f59e0b', sold: '#94a3b8',
              };
              return (
                <motion.div
                  key={status}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0, background: colors[status] ?? '#5f78f0' }}
                  className="h-full" title={`${STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status} · ${count}`}
                />
              );
            })}
            {data.statuses.length === 0 && <div className="h-full w-full bg-black/5" />}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {data.statuses.map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
                <span className="size-2 rounded-full bg-aether-500" />
                {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
                <b className="font-mono text-ink-400">{count}</b>
              </span>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 border-t border-white/60 pt-3 text-[11px] text-ink-400">
            <BadgeCheck size={12} className="text-emerald-500" />
            所有数据由哈希链背书，分析基于本机实时聚合，不上传任何统计服务。
          </p>
        </section>
      </div>
    </div>
  );
}

function Overview({ label, value, sub, accent, action }: {
  label: string; value: string; sub?: string; accent?: boolean; action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl p-4">
      <p className="text-[10px] font-bold text-ink-400">{label}</p>
      <p className={`mt-1 text-xl font-black ${accent ? 'text-gradient' : ''}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-400">{sub}</p>}
      {action}
    </div>
  );
}
