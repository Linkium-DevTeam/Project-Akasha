export interface Env {
  /** D1 数据库（藏品 / 盒子 / 图片索引 / 链上区块） */
  DB: D1Database;
  /** R2 存储桶（WebP 图片对象） */
  BUCKET: R2Bucket;
  /** 静态资源（React SPA 构建产物），用于 SPA 路由回退 */
  ASSETS: Fetcher;
  /** 哈希链工作量证明难度（前导 0 个数）；Workers 免费版建议 2 */
  CHAIN_DIFFICULTY: string;
  /** 设置后所有写操作需携带 Authorization: Bearer <token> */
  AUTH_TOKEN: string;
}
