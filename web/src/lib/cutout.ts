import { processImageFile } from './image';

/**
 * 客户端智能抠图（零依赖）：边缘种子洪泛填充 + 自适应容差 + 边缘羽化。
 * 对谷子常见的纯色桌布 / 白底 / 商品图效果最好；复杂背景会保留更多内容 ——
 * 结果始终作为「新图片」加入，原图保留，由用户审核后自行删除不满意的一版。
 */

const MAX_DIM = 1280;

export async function cutoutImage(source: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    floodRemoveBackground(img.data, w, h);
    ctx.putImageData(img, 0, 0);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('抠图导出失败'))), 'image/webp', 0.86),
    );
  } finally {
    bmp.close?.();
  }
}

/** 便捷版：抠图并走完整上传管线（含缩略图与取色），返回可直接加入藏品的新图 */
export async function cutoutAndUpload(source: Blob, sortBase: number) {
  const blob = await cutoutImage(source);
  const processed = await processImageFile(blob);
  const { uploadProcessed } = await import('../api');
  return uploadProcessed([processed], sortBase);
}

function floodRemoveBackground(px: Uint8ClampedArray, w: number, h: number) {
  const idx = (x: number, y: number) => (y * w + x) * 4;

  // 背景参考色：8 个边缘采样点（四角内缩 + 四边中点）的中值
  const seeds: Array<[number, number]> = [
    [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
    [w >> 1, 2], [w >> 1, h - 3], [2, h >> 1], [w - 3, h >> 1],
  ];
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (const [sx, sy] of seeds) {
    const i = idx(sx, sy);
    rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]);
  }
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
  const br = median(rs), bg = median(gs), bb = median(bs);

  // 自适应容差：采样点颜色离散度越大（背景不纯），容差越保守
  const spread = Math.max(...rs.map((r, i) => Math.abs(r - br) + Math.abs(gs[i] - bg) + Math.abs(bs[i] - bb)));
  const tolerance = 26 + Math.min(46, spread * 0.55);
  const tol2 = tolerance * tolerance;

  // BFS 洪泛：与参考色接近且与传播来源色接近的连通区域置透明
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const near = (i: number) => {
    const d = (px[i] - br) ** 2 + (px[i + 1] - bg) ** 2 + (px[i + 2] - bb) ** 2;
    return d <= tol2;
  };

  for (const [sx, sy] of seeds) {
    const p = sy * w + sx;
    if (!visited[p] && near(p * 4)) { visited[p] = 1; queue[tail++] = p; }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w, y = (p / w) | 0;
    const pi = p * 4;
    px[pi + 3] = 0; // 置透明
    if (x > 0 && !visited[p - 1] && near(pi - 4)) { visited[p - 1] = 1; queue[tail++] = p - 1; }
    if (x < w - 1 && !visited[p + 1] && near(pi + 4)) { visited[p + 1] = 1; queue[tail++] = p + 1; }
    if (y > 0 && !visited[p - w] && near(pi - w * 4)) { visited[p - w] = 1; queue[tail++] = p - w; }
    if (y < h - 1 && !visited[p + w] && near(pi + w * 4)) { visited[p + w] = 1; queue[tail++] = p + w; }
  }

  // 边缘羽化：紧邻透明区的像素按邻居透明率降低 alpha，弱化锯齿
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = px[p * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alpha[p] === 0) continue;
      let transparentNeighbors = 0;
      if (alpha[p - 1] === 0) transparentNeighbors++;
      if (alpha[p + 1] === 0) transparentNeighbors++;
      if (alpha[p - w] === 0) transparentNeighbors++;
      if (alpha[p + w] === 0) transparentNeighbors++;
      if (transparentNeighbors > 0) px[p * 4 + 3] = Math.round(255 * (1 - transparentNeighbors * 0.22));
    }
  }
}
