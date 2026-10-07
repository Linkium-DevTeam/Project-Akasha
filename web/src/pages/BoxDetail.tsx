import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { AnimatePresence } from 'framer-motion';
import { Copy, MapPin, Nfc, Plus, QrCode, ShieldQuestion, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/ui';
import { Spinner, Tag } from '../components/ui';
import ItemCard from '../components/ItemCard';
import ItemForm, { type ItemFormInitial } from '../components/ItemForm';
import BoxForm from '../components/BoxForm';
import { EmptyState } from '../components/ui';

export default function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scanned = params.get('scan') === '1'; // 从二维码 / NFC 抵达
  const qc = useQueryClient();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<ItemFormInitial | undefined>({ boxId: Number(id) });
  const [boxFormOpen, setBoxFormOpen] = useState(false);
  const [qrData, setQrData] = useState('');
  const [nfcState, setNfcState] = useState<'idle' | 'writing' | 'done' | 'fail'>('idle');

  const query = useQuery({
    queryKey: ['box', id, scanned],
    queryFn: () => api.boxes.get(id!, scanned),
  });
  const box = query.data?.box;

  const items = useQuery({
    queryKey: ['items', { boxId: String(id) }],
    queryFn: () => api.items.list({ boxId: String(id) }),
    enabled: !!box,
  });

  const boxUrl = box ? `${location.origin}/b/${box.code}` : '';

  useEffect(() => {
    if (box) QRCode.toDataURL(boxUrl, { margin: 1, width: 360, color: { dark: '#2e3a7d', light: '#ffffff' } })
      .then(setQrData).catch(() => {});
  }, [box, boxUrl]);

  const revealSecret = useMutation({
    mutationFn: () => api.boxes.get(id!, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['box', id] }),
  });

  /** Soul Bind：把盒码 URL 写入 NFC 标签 */
  const bindNfc = async () => {
    if (!('NDEFReader' in window)) { toast('此设备/浏览器不支持 Web NFC（需要 Android Chrome）', 'err'); return; }
    try {
      setNfcState('writing');
      const ndef = new (window as any).NDEFReader();
      await ndef.write({ records: [{ recordType: 'url', data: boxUrl }] });
      setNfcState('done');
      toast('灵魂绑定完成！触碰标签即可直达此盒 ✦', 'ok');
    } catch (e: any) {
      setNfcState('fail');
      toast(`绑定失败：${e?.message ?? e}`, 'err');
    }
  };

  if (query.isLoading) return <div className="flex justify-center py-24"><Spinner className="size-8" /></div>;
  if (query.isError || !box) {
    return (
      <EmptyState
        icon={<ShieldQuestion size={26} />} title="盒子不存在"
        action={<Link to="/lens" className="rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 px-4 py-2 text-xs font-bold text-white">去透镜扫一扫</Link>}
      />
    );
  }

  return (
    <div className="space-y-5" style={{ '--accent': box.color } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/boxes')} className="glass rounded-full px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:text-aether-700">← 收纳盒</button>
        <button onClick={() => setBoxFormOpen(true)} className="glass rounded-full px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:text-aether-700">编辑盒子</button>
      </div>

      {/* 盒头 */}
      <div className="glass relative overflow-hidden rounded-3xl p-6">
        <div className="absolute inset-x-0 top-0 h-2" style={{ background: `linear-gradient(90deg, ${box.color}, ${box.color}66)` }} />
        <div className="flex flex-wrap items-center gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black tracking-[0.2em]" style={{ color: box.color }}>{box.code}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(box.code); toast('盒码已复制', 'ok'); }}
                className="rounded-md p-1 text-ink-400 transition hover:bg-white/70 hover:text-aether-600" title="复制盒码"
              >
                <Copy size={12} />
              </button>
            </div>
            <h1 className="mt-1 truncate text-2xl font-black">{box.name}</h1>
            {box.location && <p className="mt-1 flex items-center gap-1 text-xs text-ink-400"><MapPin size={11} />{box.location}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag>{box.count} 件藏品</Tag>
              <Tag color="#64748b">{box.capacity > 0 ? `容量 ${box.capacity}` : '不限容量'}</Tag>
              {box.hasSecret && <Tag color="#8b5cf6">🔒 隐藏内容</Tag>}
            </div>
          </div>

          {/* 二维码 */}
          <div className="flex flex-col items-center gap-1.5">
            {qrData ? (
              <img src={qrData} alt={`盒码 ${box.code} 二维码`} className="size-28 rounded-xl bg-white p-1.5 shadow-md" />
            ) : (
              <div className="flex size-28 items-center justify-center rounded-xl bg-white/60"><QrCode size={40} className="text-ink-400" /></div>
            )}
            <a href={qrData} download={`akasha-${box.code}.png`} className="text-[10px] font-bold text-aether-600 hover:underline">
              下载贴纸
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* 盒内藏品 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-ink-600">盒内藏品</h2>
            <button
              onClick={() => { setFormInitial({ boxId: box.id }); setFormOpen(true); }}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-aether-500 to-aether-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-aether-500/30"
            >
              <Plus size={12} /> 放入藏品
            </button>
          </div>
          {items.isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : items.data?.items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.data.items.map((item, i) => <ItemCard key={item.id} item={item} index={i} />)}
            </div>
          ) : (
            <EmptyState icon={<Sparkles size={24} />} title="盒子还空着" hint="把第一件谷子放进来吧。" />
          )}
        </div>

        {/* 侧栏：NFC + 隐藏内容 */}
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-aether-500 to-fuchsia-500 text-white shadow-lg shadow-aether-500/40">
              <Nfc size={22} />
            </span>
            <h3 className="mt-2.5 text-sm font-black">Soul Bind · NFC 灵魂绑定</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              {'NDEFReader' in window
                ? '把手机贴近空白 NFC 标签，写入盒码传送门。'
                : '当前浏览器不支持 Web NFC。用 Android Chrome 打开即可绑定。'}
            </p>
            <button
              onClick={bindNfc}
              disabled={nfcState === 'writing' || !('NDEFReader' in window)}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-aether-500/30 transition hover:brightness-110 disabled:opacity-40"
            >
              {nfcState === 'writing' ? '贴近标签中…' : nfcState === 'done' ? '✓ 已绑定（可重写）' : '写入 NFC 标签'}
            </button>
          </div>

          {/* 隐藏内容 */}
          <div className="glass relative overflow-hidden rounded-3xl p-5">
            <h3 className="flex items-center gap-1.5 text-sm font-black">
              <ShieldQuestion size={15} className="text-violet-500" /> 隐藏内容
            </h3>
            {box.secret !== undefined ? (
              <p className="mt-2 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 px-3.5 py-3 text-sm font-medium leading-relaxed text-violet-700">
                ✦ {box.secret}
              </p>
            ) : box.hasSecret ? (
              <div className="mt-2 text-center">
                <p className="rounded-2xl bg-violet-500/8 px-3.5 py-4 text-xs leading-relaxed text-ink-400">
                  🔒 这只盒子里藏了一句话。<br />通过 NFC 或扫描盒上二维码抵达时自动揭晓。
                </p>
                <button
                  onClick={() => revealSecret.mutate()}
                  className="mt-2 text-[11px] font-bold text-violet-500 hover:underline"
                >
                  我就在盒子跟前，直接揭晓 →
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-400">这只盒子还没有隐藏内容。编辑盒子可以写一句给未来的话。</p>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {formOpen && <ItemForm open={formOpen} onClose={() => setFormOpen(false)} initial={formInitial} />}
        {boxFormOpen && <BoxForm open={boxFormOpen} onClose={() => setBoxFormOpen(false)} initial={box as any} />}
      </AnimatePresence>
    </div>
  );
}
