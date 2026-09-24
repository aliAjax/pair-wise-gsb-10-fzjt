// 替换规则：执行替换 / 撤回批次（返回新状态片段，持久化交给 storage 层）
import { nextBatchId, sameEdge } from './rules.js';

/**
 * 确认替换：一次性把故障设备的全部接线切到备件，旧设备进退役档案。
 * 新备件沿用旧设备的名称、地址、坐标，避免地址撞车。
 */
export function applyReplacement({ topology, stock, batches, retired, plan }) {
  if (!plan || !plan.ok) {
    throw new Error('方案仍处于待处理状态，不能执行替换');
  }
  const { failed, model, connections } = plan;
  const newId = `spare-${model.id.toLowerCase()}-${Date.now().toString(36)}`;
  const batchId = nextBatchId(batches);
  const at = new Date().toISOString();

  const oldEdgeKeys = connections.map((c) => c.edge);

  const newNode = {
    id: newId,
    name: failed.name, // 接管名称
    type: failed.type,
    ip: failed.ip, // 接管地址
    x: failed.x,
    y: failed.y,
    model: model.id,
    replacedAt: at,
  };

  const nodes = [...topology.nodes.filter((n) => n.id !== failed.id), newNode];
  const edges = topology.edges.map((e) =>
    e[0] === failed.id
      ? [newId, e[1]]
      : e[1] === failed.id
        ? [e[0], newId]
        : e
  );

  const batch = {
    id: batchId,
    at,
    status: 'active',
    modelId: model.id,
    modelName: model.name,
    oldNode: { ...failed },
    newNodeId: newId,
    switchedCount: oldEdgeKeys.length,
    switchedEdges: oldEdgeKeys.map((e) => [...e]),
  };

  const retiredNode = {
    ...failed,
    retiredAt: at,
    batchId,
    reason: `故障替换：${model.id} 接管`,
  };

  return {
    topology: { nodes, edges },
    stock: { ...stock, [model.id]: Math.max(0, (stock[model.id] ?? 0) - 1) },
    batches: [...batches, batch],
    retired: [...retired, retiredNode],
    batchId,
    newNodeId: newId,
    switchedCount: oldEdgeKeys.length,
  };
}

/**
 * 撤回替换：只恢复本批次切换的内容。
 * - 本批次切换走的接线切回旧设备；备件之后手工新加的接线原样保留；
 * - 备件之后手工删除的接线不凭空恢复；
 * - 备件本身移除，旧设备从退役档案回到图上；备件库存回补。
 */
export function revokeBatch({ topology, stock, batches, retired, batchId }) {
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) throw new Error('找不到该替换批次');
  if (batch.status === 'revoked') throw new Error('该批次已撤回');

  const spareExists = topology.nodes.some((n) => n.id === batch.newNodeId);
  if (!spareExists) {
    throw new Error('替换备件已被手工删除，无法自动撤回（请在图上手工恢复）');
  }

  const restored = { ...batch.oldNode };
  const nodes = [...topology.nodes.filter((n) => n.id !== batch.newNodeId), restored];

  const edges = [];
  for (const e of topology.edges) {
    const touchesSpare = e[0] === batch.newNodeId || e[1] === batch.newNodeId;
    const hit = touchesSpare
      ? batch.switchedEdges.find((se) => sameEdge(se, [batch.oldNode.id, e[0] === batch.newNodeId ? e[1] : e[0]]))
      : null;
    if (!touchesSpare) {
      edges.push(e); // 与本批次无关的连接原样保留
    } else if (hit) {
      // 本批次切换走的接线：备件还连着就切回旧设备；已被手工删除则不会出现，不凭空恢复
      const otherId = e[0] === batch.newNodeId ? e[1] : e[0];
      edges.push([restored.id, otherId]);
    } else {
      // 替换后手工新加的连接：保留，随旧设备复活改接到旧设备
      const otherId = e[0] === batch.newNodeId ? e[1] : e[0];
      edges.push([restored.id, otherId]);
    }
  }

  return {
    topology: { nodes, edges },
    stock: {
      ...stock,
      [batch.modelId]: (stock[batch.modelId] ?? 0) + 1,
    },
    batches: batches.map((b) =>
      b.id === batchId ? { ...b, status: 'revoked', revokedAt: new Date().toISOString() } : b
    ),
    retired: retired.filter((r) => r.batchId !== batchId),
  };
}
