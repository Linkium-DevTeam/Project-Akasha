import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { BadgeCheck, Copy, Gem, Printer, ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../api';
import { fmtDate, fmtMoney, fmtTime, shortHash } from '../hooks';
import { ACTION_LABEL, CONDITION_LABEL, TYPE_LABEL } from '../types';
import { EmptyState, Spinner, useToast } from '../components/ui';

/** Chain Cert · 数字确权证书（可打印） */
export default function Certificate() {
  const { itemId } = useParams();
  const toast = useToast();
  const [qr, setQr] = useState('');

  const query = useQuery({ queryKey: ['cert', itemId], queryFn: () => api.cert(itemId!) });

  const cert = query.data?.certificate;
  const certUrl = `${location.origin}/cert/${itemId}`;

  useEffect(() => {
    if (cert) {
      QRCode.toDataURL(certUrl, { margin: 1, width: 300, color: { dark: '#2e3a7d', light: '#ffffff' } })
        .then(setQr).catch(() => {});
    }
  }, [cert, certUrl]);

  const reverify = useMutation({
    mutationFn: api.chain.verify,
    onSuccess: (v) => toast(v.valid ? `全链校验通过（${v.count} 个区块）` : `第 ${v.brokenAt} 块之后出现损坏！`, v.valid ? 'ok' : 'err'),
  });

  if (query.isLoading) return <div className="flex justify-center py-24"><Spinner className="size-8" /></div>;
  if (query.isError || !cert) {
    return <EmptyState icon={<ScrollText size={26} />} title="证书不存在" hint={String((query.error as Error)?.message ?? query.error)} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <button onClick={() => history.back()} className="glass rounded-full px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:text-aether-700">← 返回</button>
        <div className="flex items-center gap-2">
          <span className={`glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold ${cert.verified ? 'text-emerald-600' : 'text-rose-500'}`}>
            {cert.verified ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
            {cert.verified ? '链上校验通过' : '链已损坏'}
          </span>
          <button onClick={() => reverify.mutate()} className="glass rounded-full px-3.5 py-2 text-xs font-bold text-aether-700 transition hover:brightness-105">
            重新校验
          </button>
          <button onClick={() => window.print()} className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:text-aether-700">
            <Printer size={14} /> 打印
          </button>
        </div>
      </div>

      {/* 证书本体 */}
      <div className="print-sheet relative overflow-hidden rounded-3xl bg-white p-1 shadow-2xl shadow-aether-900/20">
        <div className="rounded-[20px] border-2 border-aether-200 p-1.5">
          <div className="relative overflow-hidden rounded-2xl border border-aether-100 px-7 py-9 md:px-12">
            {/* 水印宝石 */}
            <Gem size={190} className="pointer-events-none absolute -right-10 -top-10 text-aether-500/5" strokeWidth={1} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-aether-400 via-fuchsia-400 to-aether-400" />

            <div className="text-center">
              <p className="text-[10px] font-black tracking-[0.4em] text-aether-500">PROJECT AKASHA · CHAIN CERT</p>
              <h1 className="mt-2 text-2xl font-black tracking-wide md:text-3xl">
                数字确权证书
              </h1>
              <p className="mt-1 text-[11px] italic text-ink-400">Certificate of Collective Existence</p>
            </div>

            <div className="mt-7 flex flex-col items-center gap-6 md:flex-row md:items-start">
              {/* 左侧信息 */}
              <div className="min-w-0 flex-1 space-y-3.5">
                <div>
                  <p className="text-[10px] font-bold text-ink-400">藏品名称</p>
                  <p className="text-lg font-black leading-snug">{cert.item.name}</p>
                  <p className="text-xs text-ink-600">
                    {[cert.item.series, cert.item.character].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                  <span><b className="text-ink-400">类型</b> {TYPE_LABEL[cert.item.type]}</span>
                  <span><b className="text-ink-400">成色</b> {CONDITION_LABEL[cert.item.condition]}</span>
                  <span><b className="text-ink-400">价值</b> {fmtMoney(cert.item.price, cert.item.currency)}</span>
                  <span><b className="text-ink-400">登记日</b> {fmtDate(cert.issuedAt)}</span>
                </div>

                <div className="space-y-2 rounded-2xl bg-aether-50/70 p-3.5 font-mono text-[10px] leading-relaxed">
                  <p className="flex items-baseline gap-2">
                    <span className="shrink-0 font-sans font-bold text-ink-400">确权哈希</span>
                    <span className="truncate" title={cert.registerHash}>{cert.registerHash}</span>
                    <button
                      className="no-print shrink-0 text-aether-500 hover:text-aether-700"
                      onClick={() => { navigator.clipboard?.writeText(cert.registerHash); toast('哈希已复制', 'ok'); }}
                    ><Copy size={11} /></button>
                  </p>
                  <p className="flex items-baseline gap-2">
                    <span className="shrink-0 font-sans font-bold text-ink-400">最新哈希</span>
                    <span className="truncate" title={cert.latestHash}>{cert.latestHash}</span>
                  </p>
                  <p className="flex gap-2">
                    <span className="font-sans font-bold text-ink-400">区块高度</span>
                    <span>#{cert.height} / 全链 {cert.chainHeight}</span>
                    <span className="ml-auto">证书编号</span>
                    <span className="font-black tracking-wider text-aether-700">{cert.certId}</span>
                  </p>
                </div>

                {/* 履历 */}
                <div>
                  <p className="mb-1 text-[10px] font-bold text-ink-400">链上履历</p>
                  <ol className="space-y-1 text-[10px] text-ink-600">
                    {cert.history.map((h) => (
                      <li key={h.id} className="flex items-center gap-2">
                        <span className="w-6 text-right font-mono text-ink-400">#{h.id}</span>
                        <b>{ACTION_LABEL[h.action as keyof typeof ACTION_LABEL] ?? h.action}</b>
                        <span className="font-mono text-ink-400">{shortHash(h.hash, 8, 4)}</span>
                        <span className="ml-auto text-ink-400">{fmtTime(h.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* 右侧：图片 + 二维码 + 印章 */}
              <div className="flex w-full shrink-0 flex-col items-center gap-3 md:w-44">
                {cert.thumbUrl ? (
                  <img src={cert.thumbUrl} alt="" className="w-36 rounded-2xl object-cover ring-1 ring-aether-100" />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-2xl bg-aether-50 text-4xl">💠</div>
                )}
                {qr && <img src={qr} alt="证书二维码" className="size-20 rounded-lg" />}
                {/* 印章 */}
                <div className="relative -rotate-6">
                  <svg width="86" height="86" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="47" fill="none" stroke="#4a5ce0" strokeWidth="2.5" opacity="0.85" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#4a5ce0" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
                    <path id="sealArc" d="M 50 14 A 36 36 0 1 1 49.99 14" fill="none" />
                    <text fontSize="9.5" fill="#4a5ce0" fontWeight="bold" letterSpacing="2.2">
                      <textPath href="#sealArc">AKASHA VOID ARCHIVE · CHAIN CERTIFIED ·</textPath>
                    </text>
                    <path d="M50 32 L66 46 L50 68 L34 46 Z" fill="none" stroke="#4a5ce0" strokeWidth="2.5" />
                    <path d="M42 47 L48 54 L59 41" fill="none" stroke="#4a5ce0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-center text-[9px] font-bold tracking-widest text-ink-400">AKASHA ARCHIVE SEAL</p>
              </div>
            </div>

            <p className="mt-7 flex items-center justify-center gap-1.5 text-center text-[10px] text-ink-400">
              <BadgeCheck size={12} className="text-aether-500" />
              本证书由阿卡莎虚无档案的哈希链背书 · 篡改任何区块都会使整链校验失败
            </p>
          </div>
        </div>
      </div>

      <div className="no-print mt-4 text-center">
        <Link to="/chain" className="text-xs font-bold text-aether-600 hover:underline">查看整条链账本 →</Link>
      </div>
    </div>
  );
}
