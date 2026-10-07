import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { api } from '../api';
import type { Item, ItemCondition, ItemStatus, ItemType } from '../types';
import { CONDITION_LABEL, STATUS_LABEL, TYPE_LABEL } from '../types';
import { Modal, Field, inputCls, useToast } from './ui';

export interface ItemFormInitial {
  id?: number;
  name?: string; series?: string; character?: string; type?: ItemType; status?: ItemStatus;
  condition?: ItemCondition; price?: number | string | null; currency?: string; purchasedAt?: string;
  notes?: string; barcode?: string; tags?: string[] | string; boxId?: number | null;
  images?: Item['images'];
}

export default function ItemForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: ItemFormInitial }) {
  const editing = !!initial?.id;
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ItemFormInitial>({});
  const [uploaded, setUploaded] = useState<Item['images']>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { type: 'badge', status: 'owned', condition: 'mint' });
      setUploaded(initial?.images ?? []);
    }
  }, [open, initial]);

  const boxes = useQuery({ queryKey: ['boxes'], queryFn: api.boxes.list, enabled: open });

  const upload = useMutation({
    mutationFn: (files: File[]) => api.upload(files),
    onSuccess: (res) => { setUploaded((prev) => [...prev, ...res.images]); setUploading(false); },
    onError: (e: Error) => { toast(e.message, 'err'); setUploading(false); },
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        price: form.price === '' || form.price == null ? null : Number(form.price),
        tags: typeof form.tags === 'string'
          ? (form.tags as string).split(/[,,]/).map((s) => s.trim()).filter(Boolean)
          : (form.tags ?? []),
        imageIds: uploaded.map((i) => i.id),
      };
      return editing ? api.items.update(initial!.id!, body) : api.items.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['item'] });
      qc.invalidateQueries({ queryKey: ['boxes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['chain'] });
      toast(editing ? '藏品已更新 · 链上已记录' : '藏品已登记 · 确权区块已生成', 'ok');
      onClose();
    },
    onError: (e: Error) => toast(e.message, 'err'),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    upload.mutate(Array.from(list).slice(0, 9));
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑藏品' : '收录新藏品'} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        {/* 图片 */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-600">图片 <span className="text-[10px] font-normal text-ink-400">自动压缩为 WebP 并提取主题色</span></span>
          <div className="flex flex-wrap gap-2">
            {uploaded.map((img) => (
              <div key={img.id} className="group relative size-20 overflow-hidden rounded-xl ring-1 ring-white/70">
                <img src={img.thumbUrl} className="size-full object-cover" alt="" />
                <button
                  type="button" aria-label="移除图片"
                  onClick={() => setUploaded((u) => u.filter((x) => x.id !== img.id))}
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-aether-300/70 bg-white/40 text-aether-500 transition hover:border-aether-400 hover:bg-white/70"
            >
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
              <span className="text-[10px] font-semibold">{uploading ? '上传中' : '添加图片'}</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        </div>

        <Field label="名称 *">
          <input required className={inputCls} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="例：星海纪念吧唧" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="系列 / 作品">
            <input className={inputCls} value={form.series ?? ''} onChange={(e) => set('series', e.target.value)} placeholder="碧蓝档案" />
          </Field>
          <Field label="角色">
            <input className={inputCls} value={form.character ?? ''} onChange={(e) => set('character', e.target.value)} placeholder="砂狼白子" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="类型">
            <select className={inputCls} value={form.type ?? 'badge'} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="状态">
            <select className={inputCls} value={form.status ?? 'owned'} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="成色">
            <select className={inputCls} value={form.condition ?? 'mint'} onChange={(e) => set('condition', e.target.value)}>
              {Object.entries(CONDITION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="价格" hint="可留空">
            <input type="number" step="0.01" min="0" className={inputCls} value={form.price ?? ''} onChange={(e) => set('price', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="购入日期">
            <input type="date" className={inputCls} value={(form.purchasedAt ?? '').slice(0, 10)} onChange={(e) => set('purchasedAt', e.target.value)} />
          </Field>
          <Field label="条形码" hint="扫码可检索">
            <input className={`${inputCls} font-mono`} value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} placeholder="EAN/UPC" />
          </Field>
        </div>

        <Field label="所属收纳盒">
          <select className={inputCls} value={form.boxId ?? ''} onChange={(e) => set('boxId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">未入盒</option>
            {boxes.data?.boxes.map((b) => (
              <option key={b.id} value={b.id}>{b.name}（{b.code}）</option>
            ))}
          </select>
        </Field>

        <Field label="标签" hint="逗号分隔">
          <input className={inputCls} value={Array.isArray(form.tags) ? form.tags.join(',') : form.tags ?? ''} onChange={(e) => set('tags', e.target.value)} placeholder="限定, 周年" />
        </Field>

        <Field label="备注">
          <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="瑕疵、购买渠道…" />
        </Field>

        <button
          type="submit" disabled={save.isPending || uploading}
          className="w-full rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-aether-500/30 transition hover:brightness-110 disabled:opacity-50"
        >
          {save.isPending ? '保存中…' : editing ? '保存修改' : '登记入册'}
        </button>
      </form>
    </Modal>
  );
}
