/** D1 便捷封装：对齐 node:sqlite 时代的 query/one/run 心智模型 */
export const now = () => new Date().toISOString();

export async function query<T = any>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...params).all<T>();
  return r.results;
}

export async function one<T = any>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | undefined> {
  const r = await db.prepare(sql).bind(...params).first<T>();
  return r ?? undefined;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<{ lastInsertRowid: number; changes: number }> {
  const r = await db.prepare(sql).bind(...params).run();
  return { lastInsertRowid: Number(r.meta.last_row_id ?? 0), changes: Number(r.meta.changes ?? 0) };
}
