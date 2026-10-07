import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 瀑布流（The Gallery）：按列数把卡片均摊，避免 CSS columns 打乱布局动画顺序。
 */
export default function Masonry({ children, gap = 16 }: { children: ReactNode[]; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(w < 420 ? 2 : w < 768 ? 3 : w < 1100 ? 4 : 5);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns: ReactNode[][] = Array.from({ length: cols }, () => []);
  children.forEach((child, i) => {
    columns[i % cols].push(child);
  });

  return (
    <div ref={ref} className="flex" style={{ gap }}>
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
          {col.map((child: any) => (
            <div key={child?.key ?? undefined}>{child}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
