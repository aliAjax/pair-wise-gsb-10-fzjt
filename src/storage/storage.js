// 持久化层：拓扑、备件库存、替换批次、退役档案都保存在本机（localStorage）
import { seedTopology } from '../data/seed.js';
import { INITIAL_STOCK } from '../data/spares.js';

const KEYS = {
  topology: 'topology',
  stock: 'spare-stock',
  batches: 'replace-batches',
  retired: 'retired-archive',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const loadState = () => ({
  topology: read(KEYS.topology, seedTopology),
  stock: read(KEYS.stock, INITIAL_STOCK),
  batches: read(KEYS.batches, []),
  retired: read(KEYS.retired, []),
});

export const persistState = ({ topology, stock, batches, retired }) => {
  localStorage.setItem(KEYS.topology, JSON.stringify(topology));
  localStorage.setItem(KEYS.stock, JSON.stringify(stock));
  localStorage.setItem(KEYS.batches, JSON.stringify(batches));
  localStorage.setItem(KEYS.retired, JSON.stringify(retired));
};

export const resetState = () => {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
};
