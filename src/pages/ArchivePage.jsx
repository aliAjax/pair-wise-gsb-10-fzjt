import React, { useState } from 'react';
import { SPARE_CATALOG, TYPE_ICONS, TYPE_LABELS } from '../data/spares.js';
import { formatTime } from './common.js';

// 备件资料、替换批次与退役档案；备件数量的盘点调整同样持久化在本机
export default function ArchivePage({ stock, setStock, batches, retired, notify }) {
  const [tab, setTab] = useState('stock');

  const adjust = (id, delta) => {
    const next = Math.max(0, (stock[id] ?? 0) + delta);
    setStock({ ...stock, [id]: next });
    notify(`备件 ${id} 库存调整为 ${next}`);
  };

  return (
    <div className="archive-page">
      <nav className="tabs">
        <button className={tab === 'stock' ? 'on' : ''} onClick={() => setTab('stock')}>
          备件资料（{SPARE_CATALOG.length}）
        </button>
        <button className={tab === 'batches' ? 'on' : ''} onClick={() => setTab('batches')}>
          替换批次（{batches.length}）
        </button>
        <button className={tab === 'retired' ? 'on' : ''} onClick={() => setTab('retired')}>
          退役档案（{retired.length}）
        </button>
      </nav>

      {tab === 'stock' && (
        <section className="panel">
          <div className="panel-head">
            <h2>备件资料与库存</h2>
            <p>数量保存在本机浏览器；执行替换自动减 1，撤回自动回补，也可在此盘点调整。</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>型号</th><th>名称</th><th>类别</th><th>接口</th><th>规格</th><th>库存</th><th style={{ width: 110 }}>盘点</th>
              </tr>
            </thead>
            <tbody>
              {SPARE_CATALOG.map((m) => (
                <tr key={m.id} className={(stock[m.id] ?? 0) === 0 ? 'zero' : ''}>
                  <td className="mono">{m.id}</td>
                  <td>{m.brand} {m.name}</td>
                  <td><i className={m.category}>{TYPE_ICONS[m.category]}</i> {TYPE_LABELS[m.category]}</td>
                  <td>{m.ports}</td>
                  <td>{m.spec}</td>
                  <td><b className={'stock-num' + ((stock[m.id] ?? 0) === 0 ? ' zero' : '')}>{stock[m.id] ?? 0}</b> 台</td>
                  <td>
                    <span className="stepper">
                      <button onClick={() => adjust(m.id, -1)}>−</button>
                      <button onClick={() => adjust(m.id, 1)}>＋</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'batches' && (
        <section className="panel">
          <div className="panel-head">
            <h2>替换批次</h2>
            <p>每个批次记录旧设备、备件型号与切换的接线；撤回只影响本批次。</p>
          </div>
          {batches.length === 0 && <p className="empty-tip">还没有执行过替换。</p>}
          <div className="batch-list">
            {batches.map((b) => (
              <div className={'batch-card ' + b.status} key={b.id}>
                <header>
                  <strong className="mono">{b.id}</strong>
                  <span className={'state-pill ' + b.status}>{b.status === 'revoked' ? '已撤回' : '进行中'}</span>
                  <small>{formatTime(b.at)}</small>
                </header>
                <div className="batch-body">
                  <span>「{b.oldNode.name}」（{b.oldNode.ip}）→ 备件 <b className="mono">{b.modelId}</b> {b.modelName}</span>
                  <span>一次切换 {b.switchedCount} 条接线{b.status === 'revoked' ? ` · 撤回于 ${formatTime(b.revokedAt)}` : ''}</span>
                  <ol className="edge-list">
                    {b.switchedEdges.map((e, i) => (
                      <li key={i} className="mono">{e[0]} — {e[1]}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'retired' && (
        <section className="panel">
          <div className="panel-head">
            <h2>退役档案</h2>
            <p>确认替换后旧设备整体转入此处；撤回对应批次时设备自动恢复在网并移出档案。</p>
          </div>
          {retired.length === 0 && <p className="empty-tip">退役档案为空。</p>}
          <table className="data-table">
            <thead>
              <tr><th>设备名称</th><th>类别</th><th>原地址</th><th>原设备 ID</th><th>退役时间</th><th>原因 / 批次</th></tr>
            </thead>
            <tbody>
              {retired.map((r) => (
                <tr key={r.id + r.batchId}>
                  <td><i className={r.type}>{TYPE_ICONS[r.type]}</i> {r.name}</td>
                  <td>{TYPE_LABELS[r.type]}</td>
                  <td className="mono">{r.ip}</td>
                  <td className="mono">{r.id}</td>
                  <td>{formatTime(r.retiredAt)}</td>
                  <td>{r.reason} <b className="mono">（{r.batchId}）</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
