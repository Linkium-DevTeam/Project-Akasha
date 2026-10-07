import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Gem, KeyRound, ScanLine, ScrollText } from 'lucide-react';
import { Modal, inputCls, useToast } from './ui';
import { getToken, setToken } from '../api';

const NAV = [
  { to: '/', label: '藏品馆', icon: Gem, end: true },
  { to: '/boxes', label: '收纳盒', icon: Boxes },
  { to: '/lens', label: '透镜', icon: ScanLine },
  { to: '/chain', label: '链账本', icon: ScrollText },
];

function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="访问令牌">
      <p className="mb-3 text-sm leading-relaxed text-ink-600">
        此服务器启用了 <code className="rounded bg-white/70 px-1 font-mono text-xs">AUTH_TOKEN</code>，写入操作需要令牌。向服务器管理员索取后粘贴到这里。
      </p>
      <input className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder="粘贴令牌…" autoFocus />
      <button
        onClick={() => { setToken(value.trim()); toast(value.trim() ? '令牌已保存' : '令牌已清除', 'ok'); onClose(); }}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-aether-500/30"
      >
        保存
      </button>
    </Modal>
  );
}

export default function Layout() {
  const [authOpen, setAuthOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const h = () => setAuthOpen(true);
    window.addEventListener('akasha:unauthorized', h);
    return () => window.removeEventListener('akasha:unauthorized', h);
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
                  `flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-white text-aether-700 shadow-sm' : 'text-ink-600 hover:bg-white/50 hover:text-aether-700'
                  }`}
              >
                <Icon size={15} />{label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setAuthOpen(true)}
            className="ml-auto rounded-xl p-2 text-ink-400 transition hover:bg-white/60 hover:text-aether-700 md:ml-1"
            title={`访问令牌${getToken() ? '（已设置）' : ''}`}
          >
            <KeyRound size={17} className={getToken() ? 'text-emerald-500' : ''} />
          </button>
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

      <AnimatePresence>{authOpen && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}</AnimatePresence>
    </div>
  );
}
