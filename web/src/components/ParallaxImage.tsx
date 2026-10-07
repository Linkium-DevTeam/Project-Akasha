import { useEffect, useRef, type PointerEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import { useGyro } from '../hooks';

/**
 * Parallax Artifact：2.5D 视差挂件。
 * 桌面端跟随鼠标，移动端使用陀螺仪；带流光（glare）与景深浮层。
 */
export default function ParallaxImage({ src, alt, accent = '#5f78f0', badges }: {
  src: string; alt: string; accent?: string; badges?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gyro = useGyro(true);

  const px = useMotionValue(0); // -1 ~ 1
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 180, damping: 18 });
  const sy = useSpring(py, { stiffness: 180, damping: 18 });

  const rotateY = useTransform(sx, [-1, 1], [-14, 14]);
  const rotateX = useTransform(sy, [-1, 1], [12, -12]);
  const glareX = useTransform(sx, [-1, 1], ['-30%', '130%']);
  const glareY = useTransform(sy, [-1, 1], ['-30%', '130%']);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.55), transparent 55%)`;
  const shadowX = useTransform(sx, [-1, 1], ['-26px', '26px']);
  const shadowY = useTransform(sy, [-1, 1], ['14px', '22px']);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    py.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onPointerLeave = () => { px.set(0); py.set(0); };

  // 陀螺仪驱动（仅在移动设备有读数时生效）
  useEffect(() => {
    if (gyro) { px.set(gyro.x); py.set(gyro.y); }
  }, [gyro, px, py]);

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative flex touch-none items-center justify-center py-6 [perspective:1200px]"
      style={{ background: `radial-gradient(ellipse 70% 60% at 50% 42%, ${accent}26, transparent 70%)` }}
    >
      {/* 底部投影 */}
      <motion.div
        aria-hidden
        className="absolute bottom-4 h-5 w-3/5 rounded-[100%] blur-lg"
        style={{ background: `${accent}55`, x: shadowX, y: shadowY }}
      />
      <motion.div
        className="relative overflow-hidden rounded-2xl ring-1 ring-white/60"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      >
        <img src={src} alt={alt} className="max-h-[62dvh] w-auto select-none object-contain" draggable={false} />
        <motion.div aria-hidden className="artifact-glare pointer-events-none absolute -inset-8" style={{ background: glare }} />
        {/* 悬浮徽章（景深层） */}
        {badges?.map((b, i) => (
          <span
            key={b}
            className="absolute rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-ink-900 shadow-lg backdrop-blur"
            style={{ top: 14 + i * 34, right: 14, transform: 'translateZ(46px)' }}
          >
            {b}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
