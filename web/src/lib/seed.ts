/**
 * 一键示例数据：在浏览器里用 canvas 生成「谷子风」艺术图，
 * 走与真实上传完全一致的流水线（WebP 压缩 + 取色 → R2 + D1 + 链上区块）。
 * 本地 wrangler dev 和线上部署都能用。
 */
import { api, uploadProcessed } from '../api';
import { processImageFile } from './image';

const PALETTES = [
  ['#5b8def', '#a78bfa', '#f0abfc'],
  ['#38bdf8', '#818cf8', '#e879f9'],
  ['#f472b6', '#fb7185', '#fbbf24'],
  ['#34d399', '#22d3ee', '#818cf8'],
  ['#f59e0b', '#ef4444', '#a855f7'],
  ['#60a5fa', '#34d399', '#fde68a'],
];

/** 确定性伪随机（种子同图同） */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成一张渐变 + 光斑 + 星芒 + 宝石的抽象画，返回 PNG blob */
function makeArt(seed: number): Promise<Blob> {
  const W = 900, H = 1200;
  const [c1, c2, c3] = PALETTES[seed % PALETTES.length];
  const rnd = mulberry32(seed * 999 + 7);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 背景对角渐变
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, c2);
  bg.addColorStop(0.55, c1);
  bg.addColorStop(1, c3);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 柔光斑（径向渐变模拟模糊）
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W, y = rnd() * H, r = 100 + rnd() * 220;
    const color = [c1, c2, c3][i % 3];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + '88');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 星芒
  ctx.fillStyle = '#ffffffdd';
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W, y = rnd() * H, s = 6 + rnd() * 18;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.28, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.28, y);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x, y + s * 0.28); ctx.lineTo(x + s, y); ctx.lineTo(x, y - s * 0.28);
    ctx.closePath(); ctx.fill();
  }

  // 同心环
  const cx = W / 2, cy = H * 0.42;
  ctx.strokeStyle = '#ffffff80';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffffff40';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  ctx.beginPath(); ctx.arc(cx, cy, 236, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // 中央宝石
  ctx.fillStyle = '#ffffffec';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 92); ctx.lineTo(cx + 78, cy - 20); ctx.lineTo(cx, cy + 96); ctx.lineTo(cx - 78, cy - 20);
  ctx.closePath(); ctx.fill();

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画布导出失败'))), 'image/png'));
}

const BOXES = [
  { name: '第一 Shrine · 吧唧专列', location: '书架 A · 第 2 层', capacity: 24, color: '#5f78f0', secret: '隐藏口令：今天也是想见你的一天 ✦' },
  { name: '第二 Shrine · 立牌之庭', location: '书架 B · 顶层', capacity: 12, color: '#e860a8', secret: '立牌们晚上会开茶话会（不告诉别人）' },
  { name: '第三 Shrine · 杂谷星云', location: '床下收纳箱 · 左', capacity: 40, color: '#0ea5b7', secret: '' },
];

const ITEMS: Array<{
  name: string; series: string; character: string; type: string;
  price: number; tags: string[]; condition?: string; status?: string; box: number; barcode?: string;
}> = [
  { name: '星海纪念吧唧', series: '碧蓝档案', character: '砂狼白子', type: 'badge', price: 25, tags: ['周年', '限定'], box: 1, barcode: '4560123456781' },
  { name: '夏日回忆吧唧', series: '原神', character: '纳西妲', type: 'badge', price: 22, tags: ['夏日'], box: 1, barcode: '4560123456798' },
  { name: '情人节吧唧', series: '蓝色监狱', character: '凪诚士郎', type: 'badge', price: 28, tags: ['情人节'], box: 1 },
  { name: 'Q 版反转吧唧', series: '咒术回战', character: '五条悟', type: 'badge', price: 30, tags: ['Q版'], box: 1 },
  { name: '亚克力大立牌', series: '碧蓝档案', character: '小鸟游星野', type: 'standee', price: 128, tags: ['大立牌', '再版'], box: 2 },
  { name: '生日限定立牌', series: '项目 sekai', character: '宵崎奏', type: 'standee', price: 98, tags: ['生日限定'], box: 2 },
  { name: '夜光亚克力牌', series: '原神', character: '雷电将军', type: 'acrylic', price: 68, tags: ['夜光'], box: 2 },
  { name: '迷你亚克力挂件', series: '排球少年', character: '孤爪研磨', type: 'acrylic', price: 35, tags: ['挂件'], box: 2 },
  { name: '团子玩偶·大', series: '原神', character: '流浪者', type: 'plush', price: 158, tags: ['玩偶', '等身'], box: 3 },
  { name: '收藏卡 SSR', series: '宝可梦', character: '梦幻', type: 'card', price: 199, tags: ['SSR', '评级卡'], condition: 'good', box: 3, barcode: '4560987654321' },
  { name: '心愿：生日吧唧套装', series: '碧蓝档案', character: '阿露老师', type: 'badge', price: 60, tags: ['心愿'], status: 'wished', box: 0 },
  { name: '胶带·星轨款', series: '东方 Project', character: '博丽灵梦', type: 'other', price: 18, tags: ['谷美'], box: 3 },
];

/** 灌入 3 个盒子 + 12 件藏品；返回创建数量 */
export async function seedDemoData(): Promise<{ boxes: number; items: number }> {
  const boxIds: number[] = [];
  for (const b of BOXES) {
    boxIds.push((await api.boxes.create(b)).box.id);
  }
  let i = 0;
  for (const it of ITEMS) {
    const art = await makeArt(i);
    const processed = await processImageFile(art);
    const upload = await uploadProcessed([processed]);
    await api.items.create({
      name: it.name, series: it.series, character: it.character,
      type: it.type as any, price: it.price, tags: it.tags,
      status: (it.status ?? 'owned') as any, condition: (it.condition ?? 'mint') as any,
      boxId: it.box === 0 ? null : boxIds[it.box - 1],
      imageIds: upload.images.map((img) => img.id),
      purchasedAt: new Date(Date.now() - (i + 3) * 86400000 * 11).toISOString().slice(0, 10),
      barcode: it.barcode ?? '',
    });
    i++;
  }
  return { boxes: BOXES.length, items: ITEMS.length };
}
