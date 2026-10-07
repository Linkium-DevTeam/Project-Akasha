#!/usr/bin/env node
/**
 * Cloudflare 资源一键初始化：
 *   1. 创建 D1 数据库 akasha（自动把 database_id 写回 worker/wrangler.jsonc）
 *   2. 创建 R2 存储桶 akasha-images
 * 之后只需：npm run db:migrate:remote && npm run deploy
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const wrangler = (cmd) => execSync(`npx wrangler ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
const CONFIG = new URL('../worker/wrangler.jsonc', import.meta.url);
const PLACEHOLDER = 'REPLACE_WITH_YOUR_D1_ID';

let config = fs.readFileSync(CONFIG, 'utf8');

if (!config.includes(PLACEHOLDER)) {
  console.log('✅ D1 database_id 已配置，跳过创建。');
} else {
  console.log('📦 创建 D1 数据库 akasha …');
  let out;
  try {
    out = wrangler('d1 create akasha');
  } catch (e) {
    out = String(e.stdout ?? '');
  }
  // 剥离 ANSI 颜色码后再解析
  const clean = out.replaceAll(/\x1b\[[0-9;]*m/g, '');
  const id = clean.match(/database_id\s*=?\s*"?([0-9a-f-]{36})"?/i)?.[1]
    ?? clean.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
  if (!id) {
    console.error('❌ 未能从 wrangler 输出中解析 database_id，请手动执行 `npx wrangler d1 create akasha` 并把 id 填入 worker/wrangler.jsonc');
    process.exit(1);
  }
  config = config.replace(PLACEHOLDER, id);
  fs.writeFileSync(CONFIG, config);
  console.log('   database_id =', id, '（已写回 wrangler.jsonc）');
}

console.log('🪣 创建 R2 存储桶 akasha-images …');
try {
  wrangler('r2 bucket create akasha-images');
  console.log('   已创建。');
} catch {
  console.log('   已存在（或创建失败，请检查账户是否启用 R2）。');
}

console.log(`
✨ 资源就绪！接下来：

  npm run db:migrate:remote   # 把表结构应用到线上 D1
  npm run deploy              # 构建前端并部署 Worker
`);
