import { useEffect, useRef, useState } from 'react';

/** 输入防抖 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** 设备方向（陀螺仪）角度，桌面端返回 null */
export function useGyro(enabled: boolean) {
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 30));   // 左右
      const y = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); // 前后（以半持握为中性）
      setTilt({ x, y });
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [enabled]);
  return tilt;
}

/** 定时消失的消息 */
export function useTimeoutFlag(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fire = () => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return [on, fire];
}

export const fmtMoney = (n: number | null, currency = 'CNY') =>
  n == null ? '—' : `${currency === 'CNY' ? '¥' : currency + ' '}${n.toLocaleString('zh-CN')}`;

export const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const shortHash = (h: string, head = 10, tail = 6) =>
  h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
