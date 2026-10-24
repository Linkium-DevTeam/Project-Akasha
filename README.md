<div align="center">
  <h1>💠 Project Akasha</h1>
  <p>
    <strong>The Void Archive for Your Reality.</strong><br>
    为二次元实体收藏打造的「虚实共生」收纳系统。
  </p>

  <p>
    <a href="#-what-is-akasha">About</a> •
    <a href="#-features">Features</a> •
    <a href="#-快速开始">Quick Start</a> •
    <a href="#-部署到-cloudflare">Deploy</a>
  </p>

  <img src="https://img.shields.io/badge/Status-Live_on_Workers-8b5cf6?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Stack-Workers_%2B_D1_%2B_R2_%2B_React-F38020?style=for-the-badge" alt="Stack">
  <img src="https://img.shields.io/badge/Vibe-Moe_%26_Elegant-ff69b4?style=for-the-badge" alt="Vibe">
</div>

<br>

## 🌌 What is Akasha?

**Project Akasha (阿卡莎)** 是一个部署在 Cloudflare 边缘的全 Serverless 收纳管理系统。

它不是传统的库存表格，而是一个**魔法容器**。它利用 **JLC 盒子** 作为物理存储单元，通过 **QR Code**、**NFC（卡迷专属）** 等技术，将你的实体谷子与数字世界连接起来。

旨在解决二次元死宅的终极痛点：
> "我知道我买了这个吧唧，但它现在在哪个盒子里？"

| The Gallery 藏品馆（线上实拍） | 数字确权证书 |
| :---: | :---: |
| <img src="docs/screenshot-gallery.png" width="420"> | <img src="docs/screenshot-cert.png" width="380"> |

## ✨ Features（已全部实现）

| Feature | Description | Serverless 实现 |
| :--- | :--- | :--- |
| **Aether Lens** | 高斯模糊 HUD 扫码透镜，玻璃拟态界面 | 浏览器摄像头 + ZXing（QR / EAN / UPC / Code128），闪光灯、相册解码、手动盒码 |
| **Material You** | **动态取色系统**，UI 主题随谷子图片自动变色 | 取色发生在你的浏览器里（canvas 像素量化提取 5 色）—— 边缘零图片算力 |
| **Parallax Artifact** | 陀螺仪 / 鼠标驱动的 **2.5D 视差** 与流光特效 | framer-motion spring 物理视差 + glare 流光 + 景深徽章 |
| **Multi-Image** | 藏品多图画廊：左右切换 / 缩略图条 / 卡片 1-N 徽章 | 每张图独立取色，切换时详情页主题随之渐变 |
| **AI Cutout** | 一键智能抠图 | 浏览器端边缘洪泛 + 自适应容差 + 羽化（零模型下载）；结果作为新图加入，原图保留由你审核 |
| **AI Assist** | 拍照识别 + 联网补全（**审核后应用**） | Workers AI（llama-3.2-11b-vision / 3.1-8b）识别照片；Bangumi 公开 API 联网搜索 + LLM 整合建议 —— 建议先勾选审核再填入表单，不直接落库 |
| **Insights** | 数据洞察：类型分布 / 月度趋势 / 系列价值榜 / 状态构成 | 纯本机实时聚合 + 手绘图表，零统计服务、零追踪 |
| **Chain Cert** | 模拟**区块链哈希**确权，独一无二的可打印数字证书 | SHA-256 哈希链 + PoW，收录/修改/移库/注销全部封存区块，整链可校验；难度随区块记录，边缘与本地互认 |
| **Soul Bind** | NFC 灵魂绑定 + 盒子隐藏内容 | Web NFC (NDEFReader) 写入盒码传送门；扫码/NFC 抵达自动揭晓盒中密语 |
| **Access 写入门禁** | 查看完全公开；写入需 Cloudflare Access 验证，**验证一次 7 天免验证** | 变更操作收敛到 `/api/write/*`，由 Cloudflare Access（会话 1 周）在边缘拦截；本地 dev 无 Access 自动放行 |
| **Edge Optimized** | 全面拥抱 Serverless，白嫖 Cloudflare 免费额度 | 浏览器端 WebP 压缩（1600px 主图 + 640px 缩略图）→ Worker 只存字节；静态资源边缘直出不计费；ZXing 按需分包 |

## 🔧 Architecture

```
                ┌───────────────── Cloudflare ─────────────────┐
 你的浏览器 ──▶ │  Workers (Hono, 22KB gzip)                   │
  图片压缩/取色  │   ├── /api/*      REST API                   │
  (canvas/WebP) │   ├── /images/*   R2 图片直读（强缓存）        │
                │   ├── D1  ·  SQLite：藏品/盒子/图片索引/区块   │
                │   └── Static Assets · React SPA 边缘直出      │
                └──────────────────────────────────────────────┘
```

| 层 | 技术 |
| :--- | :--- |
| 前端 | React 19 · Vite 7 · Tailwind CSS 4 · framer-motion · TanStack Query · ZXing · Web NFC · canvas（WebP 编码 + 取色） |
| 后端 | Hono on Cloudflare Workers · **D1**（数据库）· **R2**（图片对象存储）· Workers Static Assets |
| 密码学 | 自带 50 行同步 SHA-256（与原生 crypto 对拍 513 组一致），无需 `nodejs_compat` |

> 演进史：原案 Flutter + Fiber → 全栈 Web（Node + SQLite + sharp）→ **全面 Serverless（本版）**。
> sharp 的活儿（压缩、取色）全部前移到用户浏览器；服务器只做「认证、存储、记账」。

## 🚧 Roadmap

- [x] **Genesis**: Architecture ~~(Flutter + Fiber)~~ → React + Hono on Workers
- [x] **The Gallery**: Waterfall layout with smooth transition animations
- [x] **The Lens**: Barcode scanning with Glassmorphism UI
- [x] **Resonance**: Dynamic color extraction & Gyroscope parallax
- [x] **Soul Bind**: NFC integration for hidden content
- [x] **Chain Cert**: Hash-chain certificates with PoW & printable sheet
- [x] **Serverless Migration**: D1 + R2 + Static Assets, browser-side image pipeline

## 🚀 快速开始

要求：Node.js ≥ 20。**本地开发不需要 Cloudflare 账号** —— `wrangler dev` 会在本机模拟 D1 和 R2。

```bash
npm install
npm run db:migrate:local   # 本地 D1 建表
npm run dev                # Worker :8787 + Vite :5173 热更新
```

打开 http://localhost:8787 ，点 **「灌入示例数据」** —— 浏览器会用 canvas 现画 12 张艺术图，走与真实上传完全一致的管线（WebP 压缩 → 取色 → R2 → D1 → 上链），一键把玩全部功能。

## 📦 部署到 Cloudflare

```bash
npx wrangler login         # 首次需要登录
npm run cf:setup           # 创建 D1（自动写回 database_id）+ R2 桶
npm run db:migrate:remote  # 线上建表
npm run deploy             # 构建前端并部署 → https://project-akasha.<你的子域>.workers.dev
```

配置都在 `worker/wrangler.jsonc`：

| 项 | 说明 |
| :--- | :--- |
| `routes` | 自定义域名（如 `akasha.linkium.top`），deploy 时自动建 DNS + 证书 |
| `vars.CHAIN_DIFFICULTY` | 哈希链 PoW 难度（默认 2，适配免费版 10ms CPU 限制；难度随区块记录，改了不影响旧块校验） |
| `ai` | Workers AI 绑定（图片识别 / 补全建议），免费额度每日 neurons 足够个人使用 |

### 启用写入验证（Cloudflare Access，一次性配置）

查看永远公开；要让写入需要验证，在 Cloudflare 控制台创建一次 Access 应用：

1. Zero Trust → **Access → Applications → Add an application → Self-hosted**
2. 应用域名：`akasha.linkium.top`，路径填 `/api/write`（勾选“匹配该路径下所有请求”）
3. **Session Duration 选 `1 week`** —— 这就是“验证一次 7 天内免验证”的来源
4. 添加策略：Include → `Emails` → 填你自己的邮箱（登录方式选 Email OTP 即可，无需身份源）

未配置 Access 应用时 `/api/write/*` 不设防（单人文档模式）；配置后边缘即刻生效。本地 `wrangler dev` 没有 Access，写入直接放行。

免费额度内完全够用：Workers 10 万请求/天、D1 5GB、R2 10GB（零流出费）、静态资源无限量不计费。

## 🗺️ 使用姿势

1. **建盒**：收纳盒 → 新建盒子 → 下载二维码贴纸贴到 JLC 盒上。已经有一批贴好自有编号的盒子？创建时直接录入盒码即可（留空则自动生成 AKS-XXXX）。
2. **收录**：藏品馆 → 右下角 ➕ 收录谷子，选图即拍即传（你的手机完成压缩与取色），选好所属盒子。
3. **寻找**：忘了在哪？打开**透镜**扫盒上二维码，直达盒子；扫商品条形码可检索藏品。
4. **绑定**：Android Chrome 打开盒子详情 → Soul Bind 写入 NFC 标签，碰一碰直达。
5. **确权**：藏品详情 → 确权证书，一份带哈希链背书、可打印的数字证书就到手了。

## 💾 备份与恢复

数据是自己的心血，定期备份：

```bash
npx wrangler d1 export akasha --remote --output backup.sql        # 全库 SQL
npx wrangler r2 object get akasha-images/<key> --file <key> --remote  # 逐个图片对象
```

图片对象清单可从 `images` 表（`file`、`thumb` 列）获得。恢复：`wrangler d1 execute akasha --remote --file backup.sql` + 按 key 回传 R2。

## 📬 Stay Tuned

This project is currently under active development by a junior high school student who loves coding & anime.

**Star ⭐ this repository to get notified when the next feature drops!**

---
<div align="center">
  Made with ❤️ & ☕ · Deployed on ☁️ Cloudflare Workers
</div>
