export type ItemType = 'badge' | 'standee' | 'acrylic' | 'plush' | 'card' | 'other';
export type ItemStatus = 'owned' | 'ordered' | 'wished' | 'sold';
export type ItemCondition = 'mint' | 'good' | 'fair' | 'damaged';

export interface ItemImage {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  palette: string[];
}

export interface BoxBrief {
  id: number;
  code: string;
  name: string;
  location: string;
  color?: string;
}

export interface Item {
  id: number;
  name: string;
  series: string;
  character: string;
  type: ItemType;
  status: ItemStatus;
  condition: ItemCondition;
  price: number | null;
  currency: string;
  purchasedAt: string;
  notes: string;
  barcode: string;
  tags: string[];
  boxId: number | null;
  box: BoxBrief | null;
  images: ItemImage[];
  history?: Array<{ id: number; action: string; hash: string; nonce: number; created_at: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface Box {
  id: number;
  code: string;
  name: string;
  location: string;
  capacity: number;
  color: string;
  count: number;
  hasSecret: boolean;
  secret?: string;
  items?: number[];
  createdAt: string;
}

export interface Block {
  id: number;
  item_id: number | null;
  item_name?: string | null;
  action: 'GENESIS' | 'REGISTER' | 'UPDATE' | 'MOVE' | 'RETIRE';
  payload: string;
  prev_hash: string;
  hash: string;
  nonce: number;
  difficulty?: number;
  created_at: string;
}

export interface Certificate {
  certId: string;
  issuedAt: string;
  registerHash: string;
  latestHash: string;
  height: number;
  chainHeight: number;
  verified: boolean;
  item: {
    id: number; name: string; series: string; character: string;
    type: ItemType; status: ItemStatus; condition: ItemCondition;
    price: number | null; currency: string; createdAt: string;
  };
  thumbUrl: string | null;
  history: Array<{ id: number; action: string; hash: string; nonce: number; createdAt: string }>;
}

export interface Stats {
  items: number;
  boxes: number;
  value: number;
  byType: Array<{ type: string; count: number }>;
  recent: number[];
}

export const TYPE_LABEL: Record<ItemType, string> = {
  badge: '吧唧', standee: '立牌', acrylic: '亚克力', plush: '玩偶', card: '卡牌', other: '其他',
};

export const STATUS_LABEL: Record<ItemStatus, string> = {
  owned: '拥有', ordered: '已预订', wished: '心愿单', sold: '已出',
};

export const CONDITION_LABEL: Record<ItemCondition, string> = {
  mint: '全新', good: '良好', fair: '一般', damaged: '破损',
};

export const ACTION_LABEL: Record<Block['action'], string> = {
  GENESIS: '创世', REGISTER: '确权', UPDATE: '更新', MOVE: '移库', RETIRE: '注销',
};
