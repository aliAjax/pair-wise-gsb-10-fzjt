// 持久化层：全部保存在本机 localStorage，四类数据各用独立键，互不覆盖。

const KEYS = {
  topology: 'faultdesk.topology.v1',
  spares: 'faultdesk.spares.v1',
  retired: 'faultdesk.retired.v1',
  batches: 'faultdesk.batches.v1',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 本机存储不可用时静默降级，不影响本次操作
  }
}

export const storage = {
  loadTopology(fallback) {
    return read(KEYS.topology, fallback);
  },
  saveTopology(value) {
    write(KEYS.topology, value);
  },
  loadSpares(fallback) {
    return read(KEYS.spares, fallback);
  },
  saveSpares(value) {
    write(KEYS.spares, value);
  },
  loadRetired() {
    return read(KEYS.retired, []);
  },
  saveRetired(value) {
    write(KEYS.retired, value);
  },
  loadBatches() {
    return read(KEYS.batches, []);
  },
  saveBatches(value) {
    write(KEYS.batches, value);
  },
};
