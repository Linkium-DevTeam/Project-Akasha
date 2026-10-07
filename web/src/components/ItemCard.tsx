import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, MapPin } from 'lucide-react';
import type { Item } from '../types';
import { STATUS_LABEL, TYPE_LABEL } from '../types';
import { fmtMoney } from '../hooks';

export default function ItemCard({ item, index = 0 }: { item: Item; index?: number }) {
  const img = item.images[0];
  const palette = img?.palette ?? [];
  const accent = palette[0] ?? '#5f78f0';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        to={`/items/${item.id}`}
        className="card-shine glass block overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1"
      >
        <div className="relative" style={{ aspectRatio: img ? `${img.width}/${img.height}` : '3/4' }}>
          {img ? (
            <img
              src={img.thumbUrl} alt={item.name} loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-aether-100 to-fuchsia-50 text-3xl">💠</div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/45 to-transparent" />

          {item.status !== 'owned' && (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-moe-500 backdrop-blur">
              {item.status === 'wished' && <Heart size={10} fill="currentColor" />}
              {STATUS_LABEL[item.status]}
            </span>
          )}
          {palette.length > 0 && (
            <div className="absolute bottom-2.5 right-2.5 flex gap-1">
              {palette.slice(0, 4).map((c, i) => (
                <span key={i} className="size-2 rounded-full ring-1 ring-white/70" style={{ background: c }} />
              ))}
            </div>
          )}
          <div className="absolute bottom-2.5 left-3 right-14 text-white">
            <p className="truncate text-[13px] font-bold drop-shadow">{item.name}</p>
            <p className="truncate text-[11px] opacity-85 drop-shadow">
              {item.character || item.series || TYPE_LABEL[item.type]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-ink-400">
          <span
            className="rounded-md px-1.5 py-0.5 font-bold"
            style={{ background: `${accent}1a`, color: accent }}
          >
            {TYPE_LABEL[item.type]}
          </span>
          {item.box ? (
            <span className="flex min-w-0 items-center gap-0.5">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate font-mono">{item.box.code}</span>
            </span>
          ) : (
            <span className="text-ink-400/70">未入盒</span>
          )}
          <span className="ml-auto font-semibold text-ink-600">{fmtMoney(item.price, item.currency)}</span>
        </div>
      </Link>
    </motion.div>
  );
}
