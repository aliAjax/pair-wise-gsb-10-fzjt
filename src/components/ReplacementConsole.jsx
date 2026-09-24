import React, { useEffect, useMemo, useState } from 'react';
import { TYPE_LABELS } from '../data/spares.js';
import {
  PLAN_STATUS,
  buildPlan,
  commitReplacement,
  revokeReplacement,
} from '../services/replacement-rules.js';
import { TypeIcon } from './icons.jsx';

const fmtTime = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const STATUS_TEXT = {
  [PLAN_STATUS.IDLE]: ['待选择', 'idle'],
  [PLAN_STATUS.PENDING]: ['待处理', 'pending'],
  [PLAN_STATUS.READY]: ['可切换', 'ready'],
};

export default function ReplacementConsole({
  open,
  onClose,
  topology,
  spares,
  retired,
  batches,
  onCommit,
  onRevoke,
  onAdjustStock,
}) {
  const [tab, setTab] = useState('replace');
  const [nodeId, setNodeId] = useState('');
  const [sku, setSku] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (open) {
      setTab('replace');
      setFlash('');
      if (!nodeId && topology.nodes.length) setNodeId(topology.nodes[0].id);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const failed = topology.nodes.find((n) => n.id === nodeId) || null;
  const spare = spares.find((s) => s.sku === sku) || null;
  const plan = useMemo(
    () => buildPlan({ topology, nodeId, spare }),
    [topology, nodeId, spare],
  );

  if (!open) return null;

  const activeBatches = batches.filter((b) => b.status === 'active');

  const confirm = () => {
    try {
      const result = commitReplacement({ topology, spares, retired, batches, plan });
      onCommit(result);
      setNodeId(result.replacementId);
      setSku('');
      setFlash(`已按批次 ${result.batch.no} 完成切换，旧设备进入退役档案`);
    } catch (err) {
      setFlash(err.message);
    }
  };

  const undo = (batch) => {
    try {
      const result = revokeReplacement({ topology, spares, retired, batches, batch });
      onRevoke(result, batch);
      setNodeId(batch.failedId);
      setFlash(`已撤回批次 ${batch.no}，仅恢复本次替换，手工新加的连接已保留`);
    } catch (err) {
      setFlash(err.message);
    }
  };

  const [statusText, statusCls] = STATUS_TEXT[plan.status];

  return (
    <div className="rc-overlay" onClick={onClose}>
      <div className="rc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="rc-head">
          <div>
            <strong>故障替换台</strong>
            <small>先接管名称、地址与连接，确认后一次切换 · 数据保存在本机</small>
          </div>
          <button className="rc-close" onClick={onClose}>×</button>
        </header>

        <nav className="rc-tabs">
          {[
            ['replace', '故障替换'],
            ['parts', `备件资料 (${spares.reduce((a, s) => a + s.stock, 0)})`],
            ['batches', `替换批次 (${activeBatches.length} 可撤回)`],
            ['retired', `退役档案 (${retired.length})`],
          ].map(([key, label]) => (
            <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>

        {flash && <div className="rc-flash">{flash}</div>}

        <div className="rc-body">
          {tab === 'replace' && (
            <div className="rc-plan">
              <div className="rc-row">
                <label>
                  <span>故障设备</span>
                  <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                    {topology.nodes.length === 0 && <option value="">图上暂无设备</option>}
                    {topology.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} · {n.ip}（{TYPE_LABELS[n.type]}）
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>备用型号</span>
                  <select value={sku} onChange={(e) => setSku(e.target.value)}>
                    <option value="">请选择备件…</option>
                    {spares.map((s) => (
                      <option key={s.sku} value={s.sku}>
                        {s.maker} {s.model} · {TYPE_LABELS[s.type]} · {s.ports} 口 · 库存 {s.stock}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={`rc-status ${statusCls}`}>
                  <b>{statusText}</b>
                  <small>
                    {plan.status === PLAN_STATUS.READY
                      ? '校验通过，等待确认切换'
                      : plan.status === PLAN_STATUS.PENDING
                        ? '存在阻断项，停在待处理'
                        : '选齐故障设备与备件后生成方案'}
                  </small>
                </div>
              </div>

              {failed && (
                <div className="rc-takeover">
                  <div className="rc-subtitle">
                    <span>将被接管的名称、地址与连接</span>
                    <small>{plan.takeover.length} 条连接</small>
                  </div>
                  <div className="rc-idcard">
                    <TypeIcon type={failed.type} className={failed.type} />
                    <div>
                      <strong>{failed.name}</strong>
                      <small>{failed.ip} · {TYPE_LABELS[failed.type]}</small>
                    </div>
                    <span className="rc-arrow">接管 →</span>
                    <TypeIcon type={failed.type} className={failed.type} />
                    <div>
                      <strong>{failed.name}</strong>
                      <small>{failed.ip} · 备用设备原地替换</small>
                    </div>
                  </div>
                  <ul className="rc-conns">
                    {plan.takeover.length === 0 && <li className="rc-empty">该设备当前没有连接</li>}
                    {plan.takeover.map(({ edge, peer }, i) => (
                      <li key={i}>
                        <TypeIcon type={peer?.type} className={`mini ${peer?.type}`} />
                        <strong>{peer?.name || '未知设备'}</strong>
                        <small>{peer?.ip || '—'}</small>
                        <span className="rc-tag">{edge[0]}–{edge[1]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.checks.length > 0 && (
                <ul className="rc-checks">
                  {plan.checks.map((c, i) => (
                    <li key={i} className={c.level === 'block' ? 'block' : 'warn'}>
                      {c.level === 'block' ? '⛔' : '⚠'} {c.text}
                    </li>
                  ))}
                </ul>
              )}

              <div className="rc-actions">
                <button
                  className="rc-commit"
                  disabled={plan.status !== PLAN_STATUS.READY}
                  onClick={confirm}
                >
                  确认后一次切换连接
                </button>
                <span className="rc-hint">
                  确认后：连接整体切到备件 · 旧设备转入退役档案 · 备件库存 -1 · 生成替换批次
                </span>
              </div>
            </div>
          )}

          {tab === 'parts' && (
            <table className="rc-table">
              <thead>
                <tr><th>编号</th><th>厂商/型号</th><th>类型</th><th>接口</th><th>库存</th><th></th></tr>
              </thead>
              <tbody>
                {spares.map((s) => (
                  <tr key={s.sku}>
                    <td className="mono">{s.sku}</td>
                    <td>{s.maker} {s.model}</td>
                    <td>{TYPE_LABELS[s.type]}</td>
                    <td className="mono">{s.ports}</td>
                    <td className="mono stock">{s.stock}</td>
                    <td className="rc-stock-btns">
                      <button onClick={() => onAdjustStock(s.sku, -1)} disabled={s.stock <= 0}>−</button>
                      <button onClick={() => onAdjustStock(s.sku, 1)}>＋</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'batches' && (
            <ul className="rc-batches">
              {batches.length === 0 && <li className="rc-empty">还没有替换批次</li>}
              {batches.map((b) => (
                <li key={b.no} className={b.status}>
                  <div className="rc-batch-head">
                    <strong className="mono">{b.no}</strong>
                    <span className={`rc-pill ${b.status}`}>
                      {b.status === 'active' ? '生效中' : `已撤回 ${fmtTime(b.revokedAt || '')}`}
                    </span>
                    <small className="mono">{fmtTime(b.at)}</small>
                  </div>
                  <p>
                    <TypeIcon type={b.failedType} className={`mini ${b.failedType}`} />
                    {b.failedName}（{b.failedIp}）→ {b.spareLabel}
                    <span className="mono"> · {b.switched.length} 条连接切换</span>
                  </p>
                  {b.status === 'active' &&
                    (topology.nodes.some((n) => n.id === b.replacementId) ? (
                      <button className="rc-undo" onClick={() => undo(b)}>
                        ↩ 撤回本次替换
                      </button>
                    ) : (
                      <small className="rc-locked">替换设备已不在图上，无法撤回</small>
                    ))}
                  {b.status === 'revoked' && (
                    <small className="rc-undone">
                      已恢复旧设备与 {b.restoredEdges?.length || 0} 条原连接；
                      手工新加的 {b.carriedManualEdges?.length || 0} 条连接已保留
                    </small>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tab === 'retired' && (
            <ul className="rc-retired">
              {retired.length === 0 && <li className="rc-empty">退役档案为空</li>}
              {retired.map((r) => (
                <li key={`${r.batchNo}-${r.id}`}>
                  <TypeIcon type={r.type} className={`mini ${r.type}`} />
                  <div>
                    <strong>{r.name}</strong>
                    <small className="mono">{r.ip} · 旧 ID {r.id}</small>
                  </div>
                  <span className="mono rc-batchref">{r.batchNo}</span>
                  <small className="mono">{fmtTime(r.retiredAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
