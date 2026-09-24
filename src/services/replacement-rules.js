// 替换规则：故障替换台的业务规则全部集中在此，不碰 React 与 localStorage。
//
// 规则要点：
// 1. 备件型号必须与故障设备类型一致；
// 2. 备件接口数必须不少于当前连接数；
// 3. 备件库存必须大于 0；
// 4. 任一不满足，方案停在“待处理”，不能确认切换；
// 5. 确认后新设备整体接管旧设备的名称、IP 与全部连接，一次切换；
// 6. 撤回只恢复本次替换：手工新加的连接会保留并重新挂回到恢复的旧设备上。

export const PLAN_STATUS = {
  IDLE: 'idle',       // 尚未选齐故障设备与备件型号
  PENDING: 'pending', // 已选齐但存在阻断项，停在待处理
  READY: 'ready',     // 校验通过，可确认切换
};

let seq = 0;
function uid(prefix) {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 6)}`;
}

export function newNodeId() {
  return uid('node-');
}

export function nextBatchNo(batches) {
  const year = new Date().getFullYear();
  const count = batches.filter((b) => b.no.startsWith(`RPL-${year}-`)).length + 1;
  return `RPL-${year}-${String(count).padStart(3, '0')}`;
}

const hasEdge = (edges, a, b) =>
  edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));

// 取某设备当前的全部连接，附对端设备信息
export function connectionsOf(topology, nodeId) {
  return topology.edges
    .map((edge) => {
      if (edge[0] === nodeId) return { edge, peerId: edge[1] };
      if (edge[1] === nodeId) return { edge, peerId: edge[0] };
      return null;
    })
    .filter(Boolean)
    .map(({ edge, peerId }) => ({
      edge,
      peer: topology.nodes.find((n) => n.id === peerId) || null,
    }));
}

// 生成替换方案（不修改任何数据）
export function buildPlan({ topology, nodeId, spare }) {
  const failed = topology.nodes.find((n) => n.id === nodeId) || null;
  const takeover = failed ? connectionsOf(topology, failed.id) : [];
  const checks = [];

  if (!failed) {
    checks.push({ level: 'block', text: '请选择故障设备' });
  }
  if (!spare) {
    checks.push({ level: 'block', text: '请选择备用型号' });
  }
  if (failed && spare) {
    if (spare.type !== failed.type) {
      checks.push({ level: 'block', text: `型号类型不符：备件为「${spare.type}」，故障设备为「${failed.type}」` });
    }
    if (spare.ports < takeover.length) {
      checks.push({ level: 'block', text: `接口数量不足：备件 ${spare.ports} 个，当前连接 ${takeover.length} 条` });
    }
    if (!(spare.stock > 0)) {
      checks.push({ level: 'block', text: '备件库存为 0，无法领用' });
    }
  }

  const blocked = checks.some((c) => c.level === 'block');
  const status = !failed || !spare
    ? PLAN_STATUS.IDLE
    : blocked
      ? PLAN_STATUS.PENDING
      : PLAN_STATUS.READY;

  return { status, failed, spare, takeover, checks };
}

// 确认替换：一次切换名称、地址、连接；旧设备转入退役档案；备件出库。
// 返回下一状态所需的全部数据片段。
export function commitReplacement({ topology, spares, retired, batches, plan }) {
  if (plan.status !== PLAN_STATUS.READY) {
    throw new Error('方案仍处于待处理，不能确认切换');
  }
  const { failed, spare, takeover } = plan;
  const replacementId = newNodeId();
  const now = new Date().toISOString();
  const no = nextBatchNo(batches);

  // 新设备落到旧设备位置，整体接管名称与地址，避免图上沿用旧身份导致地址撞车
  const replacement = {
    id: replacementId,
    name: failed.name,
    type: failed.type,
    ip: failed.ip,
    x: failed.x,
    y: failed.y,
    replacedAt: now,
  };

  // 被接管的连接整体改接到新设备；记录原连接用于撤回
  const switchedEdges = new Map();
  const nextEdges = topology.edges.map((edge) => {
    if (edge[0] === failed.id || edge[1] === failed.id) {
      const other = edge[0] === failed.id ? edge[1] : edge[0];
      const next = edge[0] === failed.id ? [replacementId, other] : [other, replacementId];
      switchedEdges.set(`${edge[0]}|${edge[1]}`, next);
      return next;
    }
    return edge;
  });

  const nextTopology = {
    nodes: topology.nodes.map((n) => (n.id === failed.id ? replacement : n)),
    edges: nextEdges,
  };

  const nextSpares = spares.map((s) =>
    s.sku === spare.sku ? { ...s, stock: s.stock - 1 } : s,
  );

  const record = {
    ...failed,
    retiredAt: now,
    batchNo: no,
    replacedBy: replacementId,
    replacementSku: spare.sku,
  };

  const batch = {
    no,
    at: now,
    failedId: failed.id,
    failedName: failed.name,
    failedType: failed.type,
    failedIp: failed.ip,
    replacementId,
    sku: spare.sku,
    spareLabel: `${spare.maker} ${spare.model}`,
    switched: [...switchedEdges.entries()].map(([from, to]) => ({ from: from.split('|'), to })),
    nodeSnapshot: failed,
    status: 'active',
  };

  return {
    topology: nextTopology,
    spares: nextSpares,
    retired: [record, ...retired],
    batches: [batch, ...batches],
    batch,
    replacementId,
    takeover,
  };
}

// 撤回：只恢复本次替换。
// - 新节点移除，旧设备按替换前快照恢复；
// - 本次切换走的连接切回旧设备（对端已被删的失效连接丢弃）；
// - 替换后手工新加到新节点上的连接保留，并重新挂到旧设备；
// - 备件回库，批次标记 revoked。
export function revokeReplacement({ topology, spares, retired, batches, batch }) {
  if (!batch || batch.status !== 'active' || !topology.nodes.some((n) => n.id === batch.replacementId)) {
    throw new Error('该批次已撤回或替换设备已不在图上，不能撤回');
  }
  const now = new Date().toISOString();
  const oldId = batch.failedId;
  const newId = batch.replacementId;
  const liveIds = new Set(topology.nodes.map((n) => n.id));

  const restored = [];
  const carryManual = [];

  const nextEdges = topology.edges
    .map((edge) => {
      const touchesNew = edge[0] === newId || edge[1] === newId;
      if (!touchesNew) return edge;
      const other = edge[0] === newId ? edge[1] : edge[0];

      const switched = batch.switched.find(
        (s) => s.to[0] === edge[0] && s.to[1] === edge[1],
      );
      if (switched) {
        // 本次替换切换走的连接：对端还在才恢复，否则丢弃
        if (!liveIds.has(other) || other === newId) return null;
        restored.push(switched.from);
        return switched.from;
      }

      // 替换之后手工新加的连接：保留，重新挂回恢复的旧设备
      if (!liveIds.has(other) || other === newId) return null;
      carryManual.push(other);
      return edge[0] === newId ? [oldId, other] : [other, oldId];
    })
    .filter(Boolean);

  // 去重，防止恢复的连接与现存连接撞车
  const dedupEdges = [];
  for (const edge of nextEdges) {
    if (!hasEdge(dedupEdges, edge[0], edge[1])) dedupEdges.push(edge);
  }

  const nextTopology = {
    nodes: [
      ...topology.nodes.filter((n) => n.id !== newId),
      { ...batch.nodeSnapshot, restoredAt: now },
    ],
    edges: dedupEdges,
  };

  const nextSpares = spares.map((s) =>
    s.sku === batch.sku ? { ...s, stock: s.stock + 1 } : s,
  );

  const nextRetired = retired.filter(
    (r) => !(r.replacedBy === newId && r.batchNo === batch.no),
  );

  const nextBatches = batches.map((b) =>
    b.no === batch.no
      ? { ...b, status: 'revoked', revokedAt: now, restoredEdges: restored, carriedManualEdges: carryManual }
      : b,
  );

  return {
    topology: nextTopology,
    spares: nextSpares,
    retired: nextRetired,
    batches: nextBatches,
  };
}
