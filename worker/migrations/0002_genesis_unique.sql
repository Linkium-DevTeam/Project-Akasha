-- 创世块唯一性：防止多个 isolate 冷启动并发写入重复创世块
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocks_genesis ON blocks(action) WHERE action = 'GENESIS';
