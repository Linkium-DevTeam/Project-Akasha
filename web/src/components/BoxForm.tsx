import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Box } from '../types';
import { Field, inputCls, Modal, useToast } from './ui';

const COLORS = ['#5f78f0', '#0ea5b7', '#e860a8', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#64748b'];

export default function BoxForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Box }) {
  const editing = !!initial?.id;
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', location: '', capacity: 24, color: COLORS[0], secret: '' });

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { name: initial.name, location: initial.location, capacity: initial.capacity, color: initial.color || COLORS[0], secret: initial.secret ?? '' }
        : { name: '', location: '', capacity: 24, color: COLORS[Math.floor(Math.random() * COLORS.length)], secret: '' });
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: () => (editing ? api.boxes.update(initial!.id, form) : api.boxes.create(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boxes'] });
      qc.invalidateQueries({ queryKey: ['box'] });
      toast(editing ? '收纳盒已更新' : '收纳盒已创建 · 可用透镜扫描盒码', 'ok');
      onClose();
    },
    onError: (e: Error) => toast(e.message, 'err'),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑收纳盒' : '新的收纳盒'}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="名称 *">
          <input required autoFocus className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例：吧唧专列一号" />
        </Field>
        <Field label="存放位置">
          <input className={inputCls} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="书架 A · 第 2 层" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="容量" hint="0 = 不限">
            <input type="number" min={0} className={inputCls} value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
          </Field>
          <Field label="主题色">
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c} type="button" aria-label={c}
                  onClick={() => set('color', c)}
                  className={`size-6 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-2 ring-ink-600 scale-110' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
        <Field label="隐藏内容" hint="NFC / 扫码抵达时才会揭晓">
          <input className={inputCls} value={form.secret} onChange={(e) => set('secret', e.target.value)} placeholder="写一句给未来自己的话…" />
        </Field>
        <button
          type="submit" disabled={save.isPending}
          className="w-full rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-aether-500/30 transition hover:brightness-110 disabled:opacity-50"
        >
          {save.isPending ? '保存中…' : editing ? '保存修改' : '创建盒子'}
        </button>
      </form>
    </Modal>
  );
}
