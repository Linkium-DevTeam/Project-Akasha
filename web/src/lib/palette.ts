/**
 * 浏览器端主色提取（Material You 式动态取色）。
 * 与旧版服务端 sharp 量化逻辑一致：4bit/通道分桶 + 饱和度加权 + 色距去重。
 */
export function extractPalette(data: Uint8ClampedArray, max = 5): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number; sat: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++; bucket.sat += sat;
    } else {
      buckets.set(key, { r, g, b, n: 1, sat });
    }
  }

  const scored = [...buckets.values()]
    .map((bk) => ({
      r: bk.r / bk.n, g: bk.g / bk.n, b: bk.b / bk.n,
      score: bk.n * (0.22 + bk.sat / bk.n),
    }))
    .sort((a, b) => b.score - a.score);

  const picked: { r: number; g: number; b: number }[] = [];
  for (const c of scored) {
    if (picked.length >= max) break;
    const far = picked.every((p) => (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2 > 52 ** 2);
    if (far) picked.push(c);
  }
  if (picked.length === 0 && scored.length > 0) {
    const c = scored[0];
    picked.push({ r: c.r, g: c.g, b: c.b });
  }
  return picked.map((c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''));
}
