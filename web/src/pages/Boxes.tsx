import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import { api } from '../api';
import type { Box } from '../types';
import BoxForm from '../components/BoxForm';
import { EmptyState, Spinner, useToast } from '../components/ui';

export default function Boxes() {
  const qc = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Box | undefined>();

  const query = useQuery({ queryKey: ['boxes'], queryFn: api.boxes.list });

  const remove = useMutation({
    mutationFn: (id: number) => api.boxes.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['boxes'] }); toast('收纳盒已删除（藏品自动脱钩）', 'ok'); },
    onError: (e: Error) => toast(e.message, 'err'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            <span className="text-gradient">The Shrines</span>
            <span className="ml-2 align-middle text-sm font-bold text-ink-400">收纳盒</span>
          </h1>
          <p className="mt-1 text-xs text-ink-400">每只 JLC 盒子都有专属盒码 —— 打印 QR 贴在盒上，透镜一扫直达。</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-aether-700 transition hover:brightness-105"
        >
          <Plus size={14} /> 新建盒子
        </button>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="size-8" /></div>
      ) : query.data?.boxes.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.boxes.map((box, i) => {
            const fill = box.capacity > 0 ? Math.min(100, Math.round((box.count / box.capacity) * 100)) : 0;
            return (
              <motion.div
                key={box.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass card-shine relative overflow-hidden rounded-3xl"
              >
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${box.color}, ${box.color}88)` }} />
                <Link to={`/boxes/${box.id}`} className="block p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold tracking-widest" style={{ color: box.color }}>{box.code}</p>
                      <h2 className="mt-0.5 truncate text-base font-black">{box.name}</h2>
                      {box.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-400"><MapPin size={10} />{box.location}</p>
                      )}
                    </div>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white shadow-md" style={{ background: box.color }}>
                      {box.count}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }} animate={{ width: `${box.capacity > 0 ? fill : Math.min(100, box.count * 4)}%` }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.7, ease: 'easeOut' }}
                        style={{ background: `linear-gradient(90deg, ${box.color}, ${box.color}bb)` }}
                      />
                    </div>
                    <p className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink-400">
                      <span>{box.capacity > 0 ? `容量 ${box.count}/${box.capacity}` : `已容纳 ${box.count} 件`}</span>
                      {box.hasSecret && <span>🔒 隐藏内容</span>}
                    </p>
                  </div>
                </Link>
                <div className="flex justify-end gap-2 px-5 pb-4">
                  <button
                    onClick={() => setEditing(box)}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-ink-400 transition hover:bg-white/60 hover:text-aether-700"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => { if (confirm(`删除「${box.name}」？盒内藏品将变为未入盒状态。`)) remove.mutate(box.id); }}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-ink-400 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    删除
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Archive size={26} />}
          title="还没有收纳盒"
          hint="创建第一只 JLC 盒子，生成专属盒码与二维码。"
          action={
            <button onClick={() => setFormOpen(true)} className="rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-aether-500/30">
              新建盒子
            </button>
          }
        />
      )}

      <AnimatePresence>
        {formOpen && <BoxForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />}
      </AnimatePresence>
    </div>
  );
}
