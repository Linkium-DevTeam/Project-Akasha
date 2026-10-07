-- Project Akasha · D1 初始结构
CREATE TABLE IF NOT EXISTS boxes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  location   TEXT NOT NULL DEFAULT '',
  capacity   INTEGER NOT NULL DEFAULT 0,
  color      TEXT NOT NULL DEFAULT '',
  secret     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  series       TEXT NOT NULL DEFAULT '',
  character    TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'badge',
  status       TEXT NOT NULL DEFAULT 'owned',
  condition    TEXT NOT NULL DEFAULT 'mint',
  price        REAL,
  currency     TEXT NOT NULL DEFAULT 'CNY',
  purchased_at TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  barcode      TEXT NOT NULL DEFAULT '',
  tags         TEXT NOT NULL DEFAULT '',
  box_id       INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);

CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER REFERENCES items(id) ON DELETE CASCADE,
  file       TEXT NOT NULL,
  thumb      TEXT NOT NULL,
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  palette    TEXT NOT NULL DEFAULT '[]',
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_item ON images(item_id);

-- Chain Cert：difficulty 记录在区块上，跨环境（本地/边缘）校验互不干扰
CREATE TABLE IF NOT EXISTS blocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER,
  action     TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL,
  nonce      INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL
);
