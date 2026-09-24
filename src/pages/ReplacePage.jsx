import React, { useMemo, useState } from 'react';
import { SPARE_CATALOG, TYPE_ICONS, TYPE_LABELS } from '../data/spares.js';
import { buildPlan } from '../rules/rules.js';
import { formatTime } from './common.js';

// 故障替换台：选故障设备 + 备用型号 → 预览接管项 → 校验不过停在待处理 → 确认一次切换
export default function ReplacePage({ topology, stock, batches, retired, onApply, onRevoke, notify }) {
  const [failedId, setFailedId] = useState(topology.nodes[0]?.id || '');
  const [modelId, setModelId] = useState('');

  const activeBatches = batches.filter((b) => b.status !== 'revoked');
  const activeSpareIds = useMemo(
    () => new Set(activeBatches.map((b) => b.newNodeId)),
    [batches]
  );

  // 故障设备可能在拓扑变更后消失
  const effectiveFailedId = topology.nodes.some((n) => n.id === failedId)
    ? failedId
    : topology.nodes[0]?.id || '';

  const plan = buildPlan({
    topology,
    stock,
    activeBatchNodeIds: activeSpareIds,
    failedId: effectiveFailedId,
    modelId,
  });

  const confirm = () => {
    try {
      const result = onApply(plan);
      notify(`替换完成：批次 ${result.batchId}，已切换 ${result.switchedCount ?? ''} 条连接`);
      setFailedId(result.newNodeId);
      setModelId('');
    } catch (err) {
      notify(err.message);
    }
  };

  const revoke = (batchId) => {
    if (!window.confirm(`确定撤回批次 ${batchId}？仅恢复本次替换切换的内容，手工新加的连接保留。`)) return;
    try {
      onRevoke(batchId);
      notify(`批次 ${batchId} 已撤回，旧设备恢复在网，备件已回库`);
    } catch (err) {
      notify(err.message);
    }
  };

  const failed = plan.failed;

  return (
    <div className="replace-page">
      <section className="panel form-panel">
        <div className="panel-head">
          <h2>故障替换台</h2>
          <p>值班换机：备件沿用旧设备的名称、地址与接线，一次切换；旧设备转入退役档案。</p>
        </div>

        <div className="form-row">
          <label>
            故障设备
            <select value={effectiveFailedId} onChange={(e) => setFailedId(e.target.value)}>
              {topology.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}（{n.ip}）{activeSpareIds.has(n.id) ? ' · 替换备件' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            备用型号
            <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">— 选择备用型号 —</option>
              {SPARE_CATALOG.map((m) => (
                <option key={m.id} value={m.id} disabled={(stock[m.id] ?? 0) <= 0}>
                  {m.id} · {m.name}（{TYPE_LABELS[m.category]}·{m.ports} 口·库存 {stock[m.id] ?? 0}）
                </option>
              ))}
            </select>
          </label>
        </div>

        {modelId && plan.model && (
          <div className="model-card">
            <i className={plan.model.category}>{TYPE_ICONS[plan.model.category]}</i>
            <div>
              <strong>{plan.model.brand} {plan.model.name}</strong>
              <small>{plan.model.id} · {plan.model.spec} · 库存 {stock[plan.model.id] ?? 0} 台</small>
            </div>
          </div>
        )}
      </section>

      <section className={'panel plan-panel' + (plan.blocked ? ' blocked' : ' ready')}>
        <div className="panel-head">
          <h2>接管清单 <span className="state-tag">{plan.blocked ? '待处理' : '可切换'}</span></h2>
          <p>确认下列名称、地址与连接将由备件一次接管。</p>
        </div>

        {failed ? (
          <>
            <div className="takeover-grid">
              <div>
                <span>接管名称</span>
                <strong>{plan.takeovers.name}</strong>
              </div>
              <div>
                <span>接管地址</span>
                <strong>{plan.takeovers.ip}</strong>
              </div>
              <div>
                <span>设备类别</span>
                <strong>{TYPE_LABELS[plan.takeovers.type]}</strong>
              </div>
              <div>
                <span>接线数量</span>
                <strong>{plan.connections.length} 条（需 {plan.neededPorts} 口）</strong>
              </div>
            </div>

            <div className="conn-table">
              <div className="conn-table-head"><span>#</span><span>连接对端</span><span>对端地址</span><span>原接线</span></div>
              {plan.connections.length === 0 && <div className="conn-empty">该设备当前没有接线（0 个接口即可接管）</div>}
              {plan.connections.map((c, i) => (
                <div className="conn-row" key={i}>
                  <span>{i + 1}</span>
                  <span><i className={c.other?.type}>{TYPE_ICONS[c.other?.type]}</i>{c.other?.name || '（对端缺失）'}</span>
                  <span className="mono">{c.other?.ip || '—'}</span>
                  <span className="mono">{failed.id} — {c.otherId}</span>
                </div>
              ))}
            </div>

            <ul className="checks">
              {plan.checks.map((c) => (
                <li key={c.key} className={c.pass ? 'pass' : 'fail'}>
                  <b>{c.pass ? '✓' : '✕'}</b>
                  <span className="check-label">{c.label}</span>
                  <small>{c.detail}</small>
                </li>
              ))}
            </ul>

            <div className="plan-actions">
              <button className="primary" disabled={plan.blocked} onClick={confirm}>
                确认替换 · 一次切换全部连接
              </button>
              {plan.blocked && <span className="hint">校验未全部通过，停在待处理，不能切换</span>}
            </div>
          </>
        ) : (
          <p className="empty-tip">图上没有可选的故障设备。</p>
        )}
      </section>

      <section className="panel batch-panel">
        <div className="panel-head">
          <h2>进行中的替换批次</h2>
          <p>撤回只恢复本批次切换的连接；替换后手工新加的连接保留。</p>
        </div>
        {activeBatches.length === 0 && <p className="empty-tip">暂无进行中的替换批次。</p>}
        <div className="batch-list">
          {activeBatches.map((b) => {
            const spare = topology.nodes.find((n) => n.id === b.newNodeId);
            return (
              <div className="batch-card" key={b.id}>
                <header>
                  <strong className="mono">{b.id}</strong>
                  <small>{formatTime(b.at)}</small>
                </header>
                <div className="batch-body">
                  <span>旧设备：<b>{b.oldNode.name}</b>（{b.oldNode.ip}）→ 备件 <b className="mono">{b.modelId}</b></span>
                  <span>切换连接 {b.switchedCount} 条{spare ? '' : ' · 备件已被手工删除（不可撤回）'}</span>
                </div>
                <button className="ghost-danger" disabled={!spare} onClick={() => revoke(b.id)}>
                  ↩ 撤回本次替换
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
