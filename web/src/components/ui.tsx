import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/* ---------- Toast ---------- */

interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info' }
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

let toastId = 0;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 md:bottom-8 z-[90] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={`glass rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
                t.kind === 'ok' ? 'text-emerald-600' : t.kind === 'err' ? 'text-rose-500' : 'text-aether-700'
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="no-print fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-aether-900/25 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`glass relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
          >
            <div className="flex items-center justify-between border-b border-white/50 px-5 py-4">
              <h2 className="text-base font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 transition hover:bg-white/60 hover:text-ink-900" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div className="hide-scrollbar overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- 表单原子 ---------- */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold text-ink-600">
        {label}
        {hint && <span className="text-[10px] font-normal text-ink-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm outline-none transition placeholder:text-ink-400 focus:border-aether-400 focus:bg-white focus:ring-4 focus:ring-aether-500/10';

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
        active
          ? 'bg-gradient-to-r from-aether-500 to-aether-600 text-white shadow-md shadow-aether-500/30'
          : 'glass-soft text-ink-600 hover:text-aether-700'
      }`}
    >
      {children}
    </button>
  );
}

export function Tag({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        background: color ? `${color}1c` : 'rgba(95,120,240,0.1)',
        color: color ?? '#4a5ce0',
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, hint, action }: {
  icon: ReactNode; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="glass mx-auto flex max-w-sm flex-col items-center gap-3 rounded-3xl px-8 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-aether-100 to-fuchsia-100 text-aether-500">
        {icon}
      </div>
      <p className="font-bold">{title}</p>
      {hint && <p className="text-sm leading-relaxed text-ink-400">{hint}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block size-5 animate-spin rounded-full border-2 border-aether-500/30 border-t-aether-500 ${className}`} />
  );
}
