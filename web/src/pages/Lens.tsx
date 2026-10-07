import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserMultiFormatReader, type Result } from '@zxing/library';
import {
  ArrowRight, Flashlight, FlashlightOff, ImageUp, Keyboard, ScanLine,
} from 'lucide-react';
import { api } from '../api';
import { fmtMoney } from '../hooks';
import { TYPE_LABEL } from '../types';
import type { Item } from '../types';
import { useToast } from '../components/ui';
import ItemForm from '../components/ItemForm';
import { AnimatePresence } from 'framer-motion';

type CamState = 'idle' | 'starting' | 'on' | 'denied' | 'unavailable';

export default function Lens() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const [cam, setCam] = useState<CamState>('idle');
  const [manual, setManual] = useState('');
  const [hit, setHit] = useState<{ kind: 'box' | 'item'; text: string; item?: Item } | null>(null);
  const [torch, setTorch] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formBarcode, setFormBarcode] = useState('');

  const boxPattern = /AKS-[A-Z0-9]{3,8}/i;

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setCam('starting');
    reader.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      videoRef.current!,
      (result: Result | undefined) => {
        if (!result) return;
        const text = result.getText().trim();
        const now = Date.now();
        if (text === lastRef.current.text && now - lastRef.current.at < 2500) return;
        lastRef.current = { text, at: now };
        navigator.vibrate?.(60);
        handleText(text);
      },
    ).then(() => setCam('on')).catch((err: Error) => {
      if (err.name === 'NotAllowedError') setCam('denied');
      else setCam('unavailable');
    });

    return () => {
      reader.reset();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleText = async (text: string) => {
    const code = text.match(boxPattern)?.[0]?.toUpperCase();
    if (code) {
      try {
        const { box } = await api.resolve(code);
        setHit({ kind: 'box', text: `${box.name}（${box.code}）` });
        setTimeout(() => navigate(`/boxes/${box.id}?scan=1`), 500);
        return;
      } catch { /* 不是有效盒码，继续按条码处理 */ }
    }
    // 商品条码 → 检索藏品
    const res = await api.items.list({ barcode: text });
    if (res.items.length > 0) {
      setHit({ kind: 'item', text, item: res.items[0] });
    } else {
      setHit({ kind: 'item', text });
      setFormBarcode(text);
    }
  };

  const onManual = async () => {
    const code = manual.trim().toUpperCase();
    if (!code) return;
    try {
      const { box } = await api.resolve(code);
      navigate(`/boxes/${box.id}?scan=1`);
    } catch {
      toast(`没找到盒码 ${code}`, 'err');
    }
  };

  const decodeFromFile = async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      const result = await readerRef.current!.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      handleText(result.getText());
    } catch {
      toast('没能从这张图里读出码', 'err');
    }
  };

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = (track.getCapabilities() as any);
      if (!caps.torch) { toast('这个摄像头没有闪光灯', 'err'); return; }
      await track.applyConstraints({ advanced: [{ torch: !torch }] } as any);
      setTorch(!torch);
    } catch { toast('闪光灯切换失败', 'err'); }
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* HUD 取景框 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-[#0b1020] shadow-2xl shadow-aether-900/40">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline muted
        />
        {/* 暗角 + 扫描线 + 边角 */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,8,20,0.72)_100%)]" />
        {(cam === 'on' || cam === 'starting') && <div className="scanline" />}
        <div className="hud-corner tl" /><div className="hud-corner tr" /><div className="hud-corner bl" /><div className="hud-corner br" />

        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="glass-dark flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-sky-200">
            <ScanLine size={13} /> AETHER LENS
          </span>
          <span className={`size-2 rounded-full ${cam === 'on' ? 'bg-emerald-400 animate-pulse' : cam === 'starting' ? 'bg-amber-300' : 'bg-rose-400'}`} />
        </div>

        {cam === 'on' && (
          <button
            onClick={toggleTorch}
            className="glass-dark absolute right-4 top-4 rounded-full p-2.5 text-sky-100 transition active:scale-90"
            title="闪光灯"
          >
            {torch ? <FlashlightOff size={17} /> : <Flashlight size={17} />}
          </button>
        )}

        {(cam === 'denied' || cam === 'unavailable' || cam === 'starting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-10 text-center">
            <ScanLine size={40} className="text-sky-300/80" />
            <p className="text-sm font-bold text-sky-100">
              {cam === 'starting' ? '正在唤醒透镜…' : cam === 'denied' ? '相机权限被拒绝了' : '这台设备没有可用的相机'}
            </p>
            <p className="text-[11px] leading-relaxed text-sky-200/60">
              {cam === 'starting'
                ? '请允许浏览器使用相机。'
                : '可以手动输入盒码，或用「从图片识别」解码相册里的二维码照片。'}
            </p>
          </div>
        )}

        {/* 识别结果浮层 */}
        <AnimatePresence>
          {hit && (
            <div className="absolute inset-x-3 bottom-3">
              {hit.kind === 'box' ? (
                <div className="glass-dark rounded-2xl px-4 py-3 text-sky-100">
                  <p className="text-[10px] font-bold tracking-widest text-sky-300">BOX LOCATED</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">
                    {hit.text} <ArrowRight size={14} className="animate-pulse" />
                  </p>
                </div>
              ) : hit.item ? (
                <button
                  onClick={() => navigate(`/items/${hit.item!.id}`)}
                  className="glass-dark flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sky-100 transition active:scale-[0.98]"
                >
                  {hit.item.images[0]
                    ? <img src={hit.item.images[0].thumbUrl} className="size-11 rounded-xl object-cover" alt="" />
                    : <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-lg">💠</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold tracking-widest text-sky-300">ITEM FOUND · {TYPE_LABEL[hit.item.type]}</span>
                    <span className="block truncate text-sm font-bold">{hit.item.name}</span>
                    <span className="block text-[10px] text-sky-200/70">
                      {hit.item.box ? `在 ${hit.item.box.code} · ${hit.item.box.name}` : '未入盒'} · {fmtMoney(hit.item.price, hit.item.currency)}
                    </span>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <div className="glass-dark rounded-2xl px-4 py-3 text-sky-100">
                  <p className="text-[10px] font-bold tracking-widest text-amber-300">UNKNOWN · 未收录</p>
                  <p className="mt-0.5 font-mono text-xs">{hit.text}</p>
                  <button
                    onClick={() => { setFormBarcode(hit.text); setFormOpen(true); }}
                    className="mt-1.5 text-[11px] font-bold text-sky-300 underline decoration-dotted"
                  >
                    收录这件谷子 →
                  </button>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 手动输入 + 图片解码 */}
      <div className="glass mt-4 space-y-3 rounded-3xl p-4">
        <div className="flex items-center gap-2">
          <Keyboard size={15} className="shrink-0 text-ink-400" />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onManual()}
            placeholder="手动输入盒码，如 AKS-9R5Z"
            className="w-full bg-transparent font-mono text-sm uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-400"
          />
          <button onClick={onManual} className="shrink-0 rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-aether-500/30">
            解析
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-white/50 pt-3 text-[11px] font-semibold text-ink-400">
          <span>支持：Akasha 盒码 QR · EAN · UPC · Code 128</span>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 font-bold text-aether-600 hover:underline">
            <ImageUp size={13} /> 从图片识别
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) decodeFromFile(f); e.target.value = ''; }} />
      </div>

      <AnimatePresence>
        {formOpen && <ItemForm open={formOpen} onClose={() => setFormOpen(false)} initial={{ barcode: formBarcode }} />}
      </AnimatePresence>
    </div>
  );
}
