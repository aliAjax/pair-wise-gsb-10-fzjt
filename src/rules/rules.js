// 替换规则：接管方案计算与校验（纯函数，不碰 localStorage 与 UI）
import { getModel } from '../data/spares.js';

export const sameEdge = (e1, e2) =>
  (e1[0] === e2[0] && e1[1] === e2[1]) ||
  (e1[0] === e2[1] && e1[1] === e2[0]);

export const includesNode = (edge, id) => edge[0] === id || edge[1] === id;

// 故障设备现有连接及对端
export function connectionsOf(topology, nodeId) {
  return topology.edges
    .filter((e) => includesNode(e, nodeId))
    .map((e) => {
      const otherId = e[0] === nodeId ? e[1] : e[0];
      const other = topology.nodes.find((n) => n.id === otherId);
      return { edge: e, otherId, other };
    });
}

/**
 * 生成“故障替换”接管方案（待处理）。
 * 返回 { ok:boolean, blocked:boolean, checks[], takeovers, neededPorts, ... }
 * 型号不符 / 库存为 0 / 接口不足 等情况停在待处理，不允许确认。
 */
export function buildPlan({ topology, stock, activeBatchNodeIds, failedId, modelId }) {
  const failed = topology.nodes.find((n) => n.id === failedId) || null;
  const model = modelId ? getModel(modelId) : null;
  const connections = failed ? connectionsOf(topology, failedId) : [];
  const checks = [];

  if (!failed) {
    return { ok: false, blocked: true, failed: null, model: null, connections, neededPorts: 0, checks };
  }

  // 1) 型号类别必须与故障设备一致（路由器只能换路由器）
  const typeOk = !!model && model.category === failed.type;
  checks.push({
    key: 'type',
    label: '型号匹配',
    pass: typeOk,
    detail: model
      ? typeOk
        ? `${model.name} 可替换${failed.name}`
        : `型号类别不能替换 ${failed.type} 类设备`
      : '尚未选择备用型号',
  });

  // 2) 备件库存
  const stockCount = model ? stock[model.id] ?? 0 : 0;
  const stockOk = typeOk && stockCount > 0;
  checks.push({
    key: 'stock',
    label: '备件库存',
    pass: stockOk,
    detail: model
      ? stockOk
        ? `库存 ${stockCount} 台，可领用 1 台`
        : typeOk
          ? `库存为 0，无法领用（${model.id}）`
          : '型号类别不符，库存不适用'
      : '—',
  });

  // 3) 接口数量：接管现有接线至少需要的端口数
  const neededPorts = connections.length;
  const portsOk = typeOk && model.ports >= neededPorts;
  checks.push({
    key: 'ports',
    label: '接口数量',
    pass: portsOk,
    detail: model
      ? `需要 ${neededPorts} 个接口接管 ${connections.length} 条接线，型号提供 ${model.ports} 个`
      : '—',
  });

  // 4) 接管地址不能与在网其他设备撞车
  const conflict = topology.nodes.find(
    (n) => n.id !== failed.id && n.ip && failed.ip && n.ip === failed.ip
  );
  const addressOk = !conflict;
  checks.push({
    key: 'address',
    label: '接管地址',
    pass: addressOk,
    detail: addressOk
      ? `新设备将沿用 ${failed.ip}，无地址冲突`
      : `地址 ${failed.ip} 已被「${conflict.name}」占用，接管会撞车`,
  });

  // 5) 该设备不能已经是某次替换的备件（连锁替换需先撤回）
  const already = activeBatchNodeIds.has(failed.id);
  const plainOk = !already;
  checks.push({
    key: 'plain',
    label: '替换资格',
    pass: plainOk,
    detail: plainOk ? '设备仍为原始在网设备' : '该设备本身是替换备件，请先撤回上一批替换',
  });

  const blocked = checks.some((c) => !c.pass);

  return {
    ok: !blocked,
    blocked,
    failed,
    model,
    connections,
    neededPorts,
    takeovers: {
      name: failed.name,
      ip: failed.ip,
      type: failed.type,
      position: { x: failed.x, y: failed.y },
    },
    checks,
  };
}

// 下一个替换批次号：RPL-YYYYMMDD-序号
export function nextBatchId(existing = []) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const seq = existing.reduce((max, b) => {
    const m = b.id?.match?.(new RegExp(`^RPL-${day}-(\\d+)$`));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0) + 1;
  return `RPL-${day}-${String(seq).padStart(2, '0')}`;
}
