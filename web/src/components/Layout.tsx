import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, ChartPie, Gem, LockKeyhole, ScanLine, ScrollText } from 'lucide-react';
import { Modal, useToast } from './ui';
import { api } from '../api';

const NAV = [
  { to: '/', label: '藏品馆', icon: Gem, end: true },
  { to: '/boxes', label: '收纳盒', icon: Boxes },
  { to: '/lens', label: '透镜', icon: ScanLine },
  { to: '/insights', label: '洞察', icon: ChartPie },
  { to: '/chain', label: '链账本', icon: ScrollText },
];

/** Access 写入验证：跳到受保护路径，边缘 Access 完成验证后回程页会弹回应用 */
function AccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="需要写入验证">
      <div className="space-y-3 text-sm leading-relaxed text-ink-600">
        <p>
          查看不受影响；但<strong>写入</strong>需要先通过 <b>Cloudflare Access</b> 验证。
          验证一次后，这台设备 <b>7 天内</b>免验证写入。
        </p>
        <button
          onClick={() => api.access.start()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-aether-500/30 transition hover:brightness-110"
        >
          <LockKeyhole size={15} /> 通过 Cloudflare Access 验证
        </button>
        <p className="text-[11px] text-ink-400">验证页面由 Cloudflare 托管，完成后会自动返回当前页面。</p>
      </div>
    </Modal>
  );
}

export default function Layout() {
  const [accessOpen, setAccessOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const h = () => setAccessOpen(true);
    window.addEventListener('akasha:access', h);
    return () => window.removeEventListener('akasha:access', h);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="akasha-bg" aria-hidden>
        <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
      </div>

      {/* 顶栏（桌面） */}
      <header className="no-print sticky top-0 z-50 px-4 pt-4 md:px-6">
        <div className="glass mx-auto flex max-w-6xl items-center gap-2 rounded-2xl px-4 py-2.5">
          <NavLink to="/" className="mr-2 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-aether-400 via-aether-500 to-fuchsia-400 text-white shadow-lg shadow-aether-500/40">
              <Gem size={19} />
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-gradient text-sm font-black tracking-[0.18em]">AKASHA</span>
              <span className="text-[10px] font-medium text-ink-400">虚实收纳 · Void Archive</span>
            </span>
          </NavLink>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
                    isActive ? 'bg-white text-aether-700 shadow-sm' : 'text-ink-600 hover:bg-white/50 hover:text-aether-700'
                  }`}
              >
                <Icon size={14} />{label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-14">
        <Outlet />
      </main>

      {/* 底部导航（移动） */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
        <div className="glass mx-auto flex max-w-md items-center justify-around rounded-3xl px-2 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-2xl px-4 py-1.5 text-[10px] font-bold transition ${
                  isActive ? 'text-aether-600' : 'text-ink-400'
                }`}
            >
              {({ isActive }) => (
                <>
                  <span className={`flex size-8 items-center justify-center rounded-xl transition ${isActive ? 'bg-gradient-to-br from-aether-500 to-aether-600 text-white shadow-md shadow-aether-500/40' : ''}`}>
                    <Icon size={18} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AnimatePresence>{accessOpen && <AccessModal open={accessOpen} onClose={() => setAccessOpen(false)} />}</AnimatePresence>
    </div>
  );
}
