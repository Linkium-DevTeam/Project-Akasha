import { extractPalette } from './palette';

/**
 * 浏览器端图片流水线（Serverless 版）：
 * 原图 → EXIF 摆正 → 长边 1600px WebP 主图 + 640px 缩略图 + 5 色调色板。
 * 压缩发生在用户设备上，Worker 只负责把字节存进 R2 —— 边缘零图片算力。
 */
export interface ClientImage {
  full: Blob;
  thumb: Blob;
  mime: string;
  width: number;
  height: number;
  palette: string[];
}

const FULL_DIM = 1600;
const THUMB_DIM = 640;

export async function processImageFile(file: Blob): Promise<ClientImage> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  try {
    const [full, thumb] = await Promise.all([
      renderToBlob(bmp, FULL_DIM, 0.8),
      renderToBlob(bmp, THUMB_DIM, 0.74),
    ]);
    return {
      full,
      thumb,
      mime: full.type,
      width: bmp.width,
      height: bmp.height,
      palette: extractPaletteFrom(bmp),
    };
  } finally {
    bmp.close?.();
  }
}

async function renderToBlob(src: ImageBitmap, maxDim: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.type === 'image/webp') return blob;
    // 个别环境不支持 WebP 编码会回退 PNG，同样可用
    return blob;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片编码失败'))),
      'image/webp',
      quality,
    );
  });
}

function extractPaletteFrom(src: ImageBitmap): string[] {
  const scale = Math.min(1, 72 / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  return extractPalette(ctx.getImageData(0, 0, w, h).data);
}
