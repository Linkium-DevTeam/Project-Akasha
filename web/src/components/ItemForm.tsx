import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import { api } from '../api';
import type { Item, ItemCondition, ItemStatus, ItemType } from '../types';
import { CONDITION_LABEL, STATUS_LABEL, TYPE_LABEL } from '../types';
import { Modal, Field, inputCls, useToast } from './ui';

const FIELD_LABELS: Record<string, string> = {
  name: '名称', series: '系列 / 作品', character: '角色', type: '类型', tags: '标签', notes: '备注',
};

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
  const [aiBusy, setAiBusy] = useState<'identify' | 'enrich' | null>(null);
  const [aiResult, setAiResult] = useState<{ suggestion: Record<string, any>; sources?: Array<{ name: string; nameCn: string; date: string; summary: string }> } | null>(null);
  const [aiChecks, setAiChecks] = useState<Record<string, boolean>>({});
  const [needAccess, setNeedAccess] = useState(false);

  useEffect(() => {
    // check() 返回 true = 已验证；needAccess 语义相反
    if (open) api.access.check().then((ok) => setNeedAccess(!ok));
  }, [open]);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { type: 'badge', status: 'owned', condition: 'mint' });
      setUploaded(initial?.images ?? []);
      setAiResult(null);
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

  /* ---------- AI 助手：识别 / 联网补全（结果一律先审核再应用） ---------- */

  const applySuggestion = (s: Record<string, any>, picks: Record<string, boolean>) => {
    for (const [key, on] of Object.entries(picks)) {
      if (!on) continue;
      const v = s[key];
      if (v === undefined || v === null || v === '') continue;
      if (key === 'type') { if (TYPE_LABEL[v as ItemType]) set('type', v); continue; }
      if (key === 'tags') { set('tags', Array.isArray(v) ? v.join(',') : String(v)); continue; }
      set(key, String(v));
    }
    setAiResult(null);
    toast('建议已填入表单（尚未保存，可继续修改）', 'ok');
  };

  const runIdentify = async () => {
    const first = uploaded[0];
    if (!first) { toast('先添加一张图片再识别', 'err'); return; }
    setAiBusy('identify');
    try {
      const blob = await (await fetch(first.url)).blob();
      const small = await shrinkForAI(blob);
      const dataUrl = await blobToDataUrl(small);
      const res = await api.ai.identify(dataUrl);
      const s = res.suggestion ?? {};
      const checks: Record<string, boolean> = {};
      for (const k of Object.keys(FIELD_LABELS)) checks[k] = !String((form as any)[k] ?? '').trim();
      setAiChecks(checks);
      setAiResult({ suggestion: s });
    } catch (e) { toast((e as Error).message, 'err'); } finally { setAiBusy(null); }
  };

  const runEnrich = async () => {
    if (!String(form.name ?? '').trim() && !String(form.series ?? '').trim()) {
      toast('至少填写名称或系列再联网补全', 'err');
      return;
    }
    setAiBusy('enrich');
    try {
      const res = await api.ai.enrich({
        name: String(form.name ?? ''), series: String(form.series ?? ''),
        character: String(form.character ?? ''), barcode: String(form.barcode ?? ''),
      });
      const s = res.suggestion ?? {};
      const checks: Record<string, boolean> = {};
      for (const k of Object.keys(FIELD_LABELS)) checks[k] = !String((form as any)[k] ?? '').trim();
      setAiChecks(checks);
      setAiResult({ suggestion: s, sources: res.sources });
    } catch (e) { toast((e as Error).message, 'err'); } finally { setAiBusy(null); }
  };

  const previewValue = (key: string) => {
    const v = aiResult?.suggestion?.[key];
    if (v === undefined || v === null || v === '') return null;
    if (key === 'type') return TYPE_LABEL[v as ItemType] ?? String(v);
    if (key === 'tags') return '#' + (Array.isArray(v) ? v.join(' #') : String(v));
    return String(v);
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑藏品' : '收录新藏品'} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        {needAccess && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
            <p className="text-xs font-bold text-amber-700">🔒 写入需要先通过 Cloudflare Access 验证</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-600/80">
              验证一次后这台设备 7 天内免验证。点击下方按钮完成验证后自动返回（表单内容不会自动保留，建议验证后再填写）。
            </p>
            <button
              type="button"
              onClick={() => api.access.start()}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-2 text-xs font-bold text-white shadow-md"
            >
              通过 Cloudflare Access 验证
            </button>
          </div>
        )}
        {/* AI 助手 */}
        <div className="rounded-2xl border border-aether-200/60 bg-gradient-to-br from-aether-50/80 to-fuchsia-50/60 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-aether-700">
            <Sparkles size={13} className="text-moe-500" /> AI 助手
            <span className="ml-auto text-[10px] font-medium text-ink-400">建议仅供参考，应用前由你勾选审核</span>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button" onClick={runIdentify} disabled={aiBusy !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-aether-700 shadow-sm transition hover:bg-white disabled:opacity-50"
            >
              {aiBusy === 'identify' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              从图片识别
            </button>
            <button
              type="button" onClick={runEnrich} disabled={aiBusy !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-aether-700 shadow-sm transition hover:bg-white disabled:opacity-50"
            >
              {aiBusy === 'enrich' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              联网补全（Bangumi + AI）
            </button>
          </div>

          {aiResult && (
            <div className="mt-3 rounded-xl bg-white/85 p-3">
              <p className="text-[10px] font-bold text-ink-400">补全建议 · 勾选后应用到表单</p>
              <div className="mt-2 space-y-1.5">
                {Object.keys(FIELD_LABELS).map((key) => {
                  const preview = previewValue(key);
                  if (!preview) return null;
                  const checked = !!aiChecks[key];
                  const current = String((form as any)[key] ?? '').trim();
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-aether-50">
                      <input
                        type="checkbox" checked={checked}
                        onChange={(e) => setAiChecks((c) => ({ ...c, [key]: e.target.checked }))}
                        className="size-3.5 accent-aether-500"
                      />
                      <span className="w-14 shrink-0 text-[11px] font-bold text-ink-600">{FIELD_LABELS[key]}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-400">
                        {current ? `保留「${current}」` : '（空）'}
                        <span className="mx-1">→</span>
                        <b className="text-aether-700">{preview}</b>
                      </span>
                    </label>
                  );
                })}
              </div>
              {aiResult.sources && aiResult.sources.length > 0 && (
                <p className="mt-2 border-t border-aether-100 pt-2 text-[10px] leading-relaxed text-ink-400">
                  来源：Bangumi「{(aiResult.sources[0].nameCn || aiResult.sources[0].name).slice(0, 24)}」等 {aiResult.sources.length} 条结果
                </p>
              )}
              <button
                type="button"
                onClick={() => applySuggestion(aiResult.suggestion, aiChecks)}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2 text-[11px] font-bold text-white shadow-md shadow-aether-500/25"
              >
                <Check size={13} /> 应用所选项
              </button>
            </div>
          )}
        </div>

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
          type="submit" disabled={save.isPending || uploading || needAccess}
          className="w-full rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-aether-500/30 transition hover:brightness-110 disabled:opacity-50"
        >
          {save.isPending ? '保存中…' : needAccess ? '（先完成上方验证）' : editing ? '保存修改' : '登记入册'}
        </button>
      </form>
    </Modal>
  );
}

/** 识别前压缩图片到 768px 以内的 dataURL，控制 AI 请求体积 */
async function shrinkForAI(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('压缩失败'))), 'image/webp', 0.82),
    );
  } finally {
    bmp.close?.();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('读取图片失败'));
    r.readAsDataURL(blob);
  });
}
