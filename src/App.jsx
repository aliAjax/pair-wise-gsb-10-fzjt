import React, { useEffect, useRef, useState } from 'react';
import { seedTopology } from './data/topology-seed.js';
import { defaultSpares } from './data/spares.js';
import { storage } from './services/persistence.js';
import { TYPE_GLYPH } from './components/icons.jsx';
import ReplacementConsole from './components/ReplacementConsole.jsx';

export default function TopologyApp() {
  const [data, setData] = useState(() => storage.loadTopology(seedTopology));
  const [spares, setSpares] = useState(() => storage.loadSpares(defaultSpares));
  const [retired, setRetired] = useState(() => storage.loadRetired());
  const [batches, setBatches] = useState(() => storage.loadBatches());
  const [consoleOpen, setConsoleOpen] = useState(false);

  const [selected, setSelected] = useState(data.nodes[0]?.id ?? '');
  const [notice, setNotice] = useState('');
  const [drag, setDrag] = useState(null);
  const board = useRef();

  // 四类数据各自独立持久化到本机
  useEffect(() => storage.saveTopology(data), [data]);
  useEffect(() => storage.saveSpares(spares), [spares]);
  useEffect(() => storage.saveRetired(retired), [retired]);
  useEffect(() => storage.saveBatches(batches), [batches]);

  const node = data.nodes.find((n) => n.id === selected) || data.nodes[0];

  const updateNode = (k, v) =>
    setData((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === selected ? { ...n, [k]: v } : n)) }));

  const addNode = (type, name) => {
    const id = 'node' + Date.now();
    const n = { id, name: name || '新设备', type: type || 'device', x: 500, y: 300, ip: '192.168.0.10' };
    setData((d) => ({ ...d, nodes: [...d.nodes, n] }));
    setSelected(id);
    setNotice('已添加设备');
  };

  const connect = () => {
    if (!node) return;
    const other = prompt('输入要连接的设备 ID（例如 sw1）');
    if (
      other &&
      data.nodes.some((n) => n.id === other) &&
      other !== node.id &&
      !data.edges.some((e) => (e[0] === node.id && e[1] === other) || (e[1] === node.id && e[0] === other))
    ) {
      setData((d) => ({ ...d, edges: [...d.edges, [node.id, other]] }));
      setNotice('连接已创建（手工新增，撤回替换时会保留）');
    }
  };

  const remove = () => {
    if (!node) return;
    setData((d) => ({
      nodes: d.nodes.filter((n) => n.id !== node.id),
      edges: d.edges.filter((e) => !e.includes(node.id)),
    }));
    setSelected(data.nodes.find((n) => n.id !== node.id)?.id);
    setNotice('设备已删除');
  };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'network-topology.json';
    a.click();
    setNotice('JSON 已导出');
  };

  const validate = () => {
    const linked = new Set(data.edges.flat());
    const isolated = data.nodes.filter((n) => !linked.has(n.id));
    // 地址撞车检查：值班换机后最容易出现重复 IP
    const seen = new Map();
    data.nodes.forEach((n) => seen.set(n.ip, (seen.get(n.ip) || 0) + 1));
    const dupIp = [...seen].filter(([, c]) => c > 1).map(([ip]) => ip);
    const msgs = [];
    if (isolated.length) msgs.push(`${isolated.length} 个孤立节点`);
    if (dupIp.length) msgs.push(`地址撞车：${dupIp.join('、')}`);
    setNotice(msgs.length ? `检查发现：${msgs.join('；')}` : '拓扑检查通过：无孤立节点、无地址撞车');
  };

  const move = (e) => {
    if (!drag) return;
    const r = board.current.getBoundingClientRect();
    setData((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === drag ? { ...n, x: Math.max(35, e.clientX - r.left), y: Math.max(35, e.clientY - r.top) } : n,
      ),
    }));
  };

  const handleCommit = (result) => {
    setData(result.topology);
    setSpares(result.spares);
    setRetired(result.retired);
    setBatches(result.batches);
    setSelected(result.replacementId);
    setNotice(`批次 ${result.batch.no} 已切换：${result.batch.failedName} 由备件接管`);
  };

  const handleRevoke = (result, batch) => {
    setData(result.topology);
    setSpares(result.spares);
    setRetired(result.retired);
    setBatches(result.batches);
    setSelected(batch.failedId);
    setNotice(`批次 ${batch.no} 已撤回，只恢复本次替换`);
  };

  const adjustStock = (sku, delta) =>
    setSpares((list) => list.map((s) => (s.sku === sku ? { ...s, stock: Math.max(0, s.stock + delta) } : s)));

  const activeCount = batches.filter((b) => b.status === 'active').length;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-mark">⌁</span>
          <div>
            <strong>NETSCAPE</strong>
            <small>FAULT REPLACEMENT DESK</small>
          </div>
        </div>
        <div className="file">
          <span className="dot"></span>
          <div>
            <strong>office-network.json</strong>
            <small>备件 / 批次 / 档案保存在本机</small>
          </div>
        </div>
        <div className="top-actions">
          <button onClick={validate}>✓ 检查</button>
          <button onClick={exportJson}>↓ 导出</button>
          <button className="save" onClick={() => setConsoleOpen(true)}>
            🛠 故障替换台{activeCount ? ` · ${activeCount}` : ''}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="tool-group">
          <span>工具</span>
          <button className="on">↖ 选择</button>
          <button onClick={connect}>⌁ 连接</button>
          <button onClick={() => addNode()}>＋ 设备</button>
          <button className="fault-btn" onClick={() => setConsoleOpen(true)}>🛠 故障替换</button>
        </div>
        <div className="tool-group zoom">
          <button>−</button>
          <span>100%</span>
          <button>＋</button>
          <button onClick={() => setNotice('画布已居中')}>⌗</button>
        </div>
      </div>

      <div className="workspace">
        <aside className="inventory">
          <div className="section-title">
            <span>设备库</span>
            <small>{data.nodes.length} 个节点</small>
          </div>
          <div className="device-types">
            {[
              ['router', '路由器'],
              ['switch', '交换机'],
              ['server', '服务器'],
              ['device', '终端设备'],
            ].map(([t, l]) => (
              <button onClick={() => addNode(t, l)} key={t}>
                <i className={t}>{TYPE_GLYPH(t)}</i>
                {l}
                <span>＋</span>
              </button>
            ))}
          </div>
          <div className="section-title nodes-head">
            <span>图中节点</span>
            <small>点击查看</small>
          </div>
          <div className="node-list">
            {data.nodes.map((n) => (
              <button className={selected === n.id ? 'sel' : ''} onClick={() => setSelected(n.id)} key={n.id}>
                <i className={n.type}>{TYPE_GLYPH(n.type)}</i>
                <span>
                  <strong>{n.name}</strong>
                  <small>{n.ip}</small>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="canvas-wrap">
          <div className="canvas" ref={board} onMouseMove={move} onMouseUp={() => setDrag(null)}>
            {data.edges.map(([a, b], i) => {
              const n1 = data.nodes.find((n) => n.id === a);
              const n2 = data.nodes.find((n) => n.id === b);
              if (!n1 || !n2) return null;
              const dx = n2.x - n1.x;
              const dy = n2.y - n1.y;
              const len = Math.hypot(dx, dy);
              const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <div className="edge" key={i} style={{ left: n1.x, top: n1.y, width: len, transform: `rotate(${ang}deg)` }}>
                  <span></span>
                </div>
              );
            })}
            {data.nodes.map((n) => (
              <button
                className={'node ' + n.type + (selected === n.id ? ' picked' : '')}
                style={{ left: n.x - 42, top: n.y - 31 }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelected(n.id);
                  setDrag(n.id);
                }}
                onClick={() => setSelected(n.id)}
                key={n.id}
              >
                <i>{TYPE_GLYPH(n.type)}</i>
                <strong>{n.name}</strong>
                <small>{n.ip}</small>
              </button>
            ))}
            <div className="legend">
              <span><i className="router"></i>路由器</span>
              <span><i className="switch"></i>交换机</span>
              <span><i className="server"></i>服务器</span>
            </div>
          </div>
          <div className="canvas-footer">
            <span>拖动节点调整位置 · {data.edges.length} 条连接 · 换机请走「故障替换台」</span>
            <span>坐标系：画布局部</span>
          </div>
        </section>

        <aside className="inspector">
          <div className="section-title">
            <span>属性</span>
            <small>{node?.type || '—'}</small>
          </div>
          {node ? (
            <>
              <label>
                设备名称
                <input value={node.name} onChange={(e) => updateNode('name', e.target.value)} />
              </label>
              <label>
                IP 地址
                <input value={node.ip} onChange={(e) => updateNode('ip', e.target.value)} />
              </label>
              <label>
                设备类型
                <select value={node.type} onChange={(e) => updateNode('type', e.target.value)}>
                  <option value="router">路由器</option>
                  <option value="switch">交换机</option>
                  <option value="server">服务器</option>
                  <option value="device">终端设备</option>
                </select>
              </label>
              <div className="inspector-actions">
                <button onClick={connect}>⌁ 添加连接</button>
                <button className="danger" onClick={remove}>删除设备</button>
              </div>
              <div className="connections">
                <div className="section-title">
                  <span>连接</span>
                  <small>{data.edges.filter((e) => e.includes(node.id)).length} 条</small>
                </div>
                {data.edges
                  .filter((e) => e.includes(node.id))
                  .map((e, i) => {
                    const other = data.nodes.find((n) => n.id === (e[0] === node.id ? e[1] : e[0]));
                    return (
                      <div className="connection" key={i}>
                        <span className={'mini ' + other?.type}></span>
                        <strong>{other?.name || '已删除设备'}</strong>
                        <small>在线</small>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <p>选择一个设备</p>
          )}
        </aside>
      </div>

      {notice && <div className="toast">{notice}</div>}

      <ReplacementConsole
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        topology={data}
        spares={spares}
        retired={retired}
        batches={batches}
        onCommit={handleCommit}
        onRevoke={handleRevoke}
        onAdjustStock={adjustStock}
      />
    </div>
  );
}
