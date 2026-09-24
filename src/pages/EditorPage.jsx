import React, { useRef, useState } from 'react';
import { TYPE_ICONS } from '../data/spares.js';

// 拓扑编辑页：保持原有画图、改名/改地址、手工加连接、删除、检查、导出能力
export default function EditorPage({ topology, setTopology, batches, notify }) {
  const [selected, setSelected] = useState('gw');
  const [tool, setTool] = useState('select');
  const [drag, setDrag] = useState(null);
  const board = useRef();

  const replacedNodeIds = new Set(batches.filter((b) => b.status !== 'revoked').map((b) => b.newNodeId));

  const node = topology.nodes.find((n) => n.id === selected) || topology.nodes[0];

  const updateNode = (k, v) =>
    setTopology({
      ...topology,
      nodes: topology.nodes.map((n) => (n.id === selected ? { ...n, [k]: v } : n)),
    });

  const addNode = (type = 'device', label = '新设备') => {
    const id = 'node' + Date.now();
    setTopology({
      ...topology,
      nodes: [...topology.nodes, { id, name: label, type, x: 500, y: 300, ip: '192.168.0.10' }],
    });
    setSelected(id);
    setTool('select');
    notify('已添加设备');
  };

  const connect = () => {
    if (!selected) return;
    const other = prompt('输入要连接的设备 ID（例如 sw1）');
    if (
      other &&
      topology.nodes.some((n) => n.id === other) &&
      other !== selected &&
      !topology.edges.some(
        (e) => (e[0] === selected && e[1] === other) || (e[1] === selected && e[0] === other)
      )
    ) {
      setTopology({ ...topology, edges: [...topology.edges, [selected, other]] });
      notify('连接已创建（手工连接，撤回替换时会保留）');
    }
  };

  const remove = () => {
    setTopology({
      ...topology,
      nodes: topology.nodes.filter((n) => n.id !== selected),
      edges: topology.edges.filter((e) => !e.includes(selected)),
    });
    setSelected(topology.nodes.find((n) => n.id !== selected)?.id);
    notify('设备已删除');
  };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(topology, null, 2)], { type: 'application/json' })
    );
    a.download = 'network-topology.json';
    a.click();
    notify('JSON 已导出');
  };

  const validate = () => {
    const linked = new Set(topology.edges.flat());
    const isolated = topology.nodes.filter((n) => !linked.has(n.id));
    const ipSeen = new Map();
    topology.nodes.forEach((n) => n.ip && ipSeen.set(n.ip, [...(ipSeen.get(n.ip) || []), n]));
    const dup = [...ipSeen.values()].filter((g) => g.length > 1);
    if (isolated.length) notify(`发现 ${isolated.length} 个孤立节点`);
    else if (dup.length) notify(`地址撞车：${dup.map((g) => g[0].ip).join('、')}`);
    else notify('拓扑检查通过：无孤立节点，无地址冲突');
  };

  const move = (e) => {
    if (!drag) return;
    const r = board.current.getBoundingClientRect();
    setTopology({
      ...topology,
      nodes: topology.nodes.map((n) =>
        n.id === drag
          ? { ...n, x: Math.max(35, e.clientX - r.left), y: Math.max(35, e.clientY - r.top) }
          : n
      ),
    });
  };

  const types = [
    ['router', '◉', '路由器'],
    ['switch', '▦', '交换机'],
    ['server', '▣', '服务器'],
    ['device', '▱', '终端设备'],
  ];

  return (
    <div className="workspace">
      <aside className="inventory">
        <div className="section-title">
          <span>设备库</span>
          <small>{topology.nodes.length} 个节点</small>
        </div>
        <div className="device-types">
          {types.map(([t, i, l]) => (
            <button onClick={() => addNode(t, l)} key={t}>
              <i className={t}>{i}</i>
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
          {topology.nodes.map((n) => (
            <button className={selected === n.id ? 'sel' : ''} onClick={() => setSelected(n.id)} key={n.id}>
              <i className={n.type}>{TYPE_ICONS[n.type]}</i>
              <span>
                <strong>{n.name}{replacedNodeIds.has(n.id) ? ' 🔁' : ''}</strong>
                <small>{n.ip}</small>
              </span>
              <b>›</b>
            </button>
          ))}
        </div>
      </aside>

      <section className="canvas-wrap">
        <div className="canvas" ref={board} onMouseMove={move} onMouseUp={() => setDrag(null)}>
          {topology.edges.map(([a, b], i) => {
            const n1 = topology.nodes.find((n) => n.id === a);
            const n2 = topology.nodes.find((n) => n.id === b);
            if (!n1 || !n2) return null;
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const len = Math.hypot(dx, dy);
            const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <div
                className="edge"
                key={i}
                style={{ left: n1.x, top: n1.y, width: len, transform: `rotate(${ang}deg)` }}
              >
                <span></span>
              </div>
            );
          })}
          {topology.nodes.map((n) => (
            <button
              className={'node ' + n.type + (selected === n.id ? ' picked' : '') + (replacedNodeIds.has(n.id) ? ' is-spare' : '')}
              style={{ left: n.x - 42, top: n.y - 31 }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelected(n.id);
                setDrag(n.id);
              }}
              onClick={() => setSelected(n.id)}
              key={n.id}
              title={n.model ? `替换备件 ${n.model}` : n.name}
            >
              <i>{TYPE_ICONS[n.type]}</i>
              <strong>{n.name}</strong>
              <small>{n.ip}</small>
            </button>
          ))}
          <div className="legend">
            <span><i className="router"></i>路由器</span>
            <span><i className="switch"></i>交换机</span>
            <span><i className="server"></i>服务器</span>
            <span className="legend-spare">🔁 替换备件</span>
          </div>
        </div>
        <div className="canvas-footer">
          <span>拖动节点调整位置 · {topology.edges.length} 条连接 · 🔁 为替换备件（去故障台撤回）</span>
          <span>坐标系：画布局部</span>
        </div>
      </section>

      <aside className="inspector">
        <div className="section-title">
          <span>属性</span>
          <small>{node?.type}</small>
        </div>
        {node ? (
          <>
            {replacedNodeIds.has(node.id) && (
              <div className="spare-banner">该设备是故障替换备件，型号 {node.model}</div>
            )}
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
                <small>{topology.edges.filter((e) => e.includes(node.id)).length} 条</small>
              </div>
              {topology.edges
                .filter((e) => e.includes(node.id))
                .map((e, i) => {
                  const other = topology.nodes.find(
                    (n) => n.id === (e[0] === node.id ? e[1] : e[0])
                  );
                  return (
                    <div className="connection" key={i}>
                      <span className={'mini ' + other?.type}></span>
                      <strong>{other?.name || '（已删除）'}</strong>
                      <small>在线</small>
                    </div>
                  );
                })}
            </div>
            <div className="inspector-actions" style={{ borderBottom: 0 }}>
              <button onClick={validate}>✓ 检查拓扑</button>
              <button onClick={exportJson}>↓ 导出 JSON</button>
            </div>
          </>
        ) : (
          <p>选择一个设备</p>
        )}
      </aside>
    </div>
  );
}
