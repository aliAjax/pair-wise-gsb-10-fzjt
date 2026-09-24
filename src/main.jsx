import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadState, persistState, resetState } from './storage/storage.js';
import { applyReplacement, revokeBatch } from './rules/ops.js';
import EditorPage from './pages/EditorPage.jsx';
import ReplacePage from './pages/ReplacePage.jsx';
import ArchivePage from './pages/ArchivePage.jsx';

function App() {
  const initial = loadState();
  const [topology, setTopology] = useState(initial.topology);
  const [stock, setStock] = useState(initial.stock);
  const [batches, setBatches] = useState(initial.batches);
  const [retired, setRetired] = useState(initial.retired);
  const [page, setPage] = useState('replace');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    persistState({ topology, stock, batches, retired });
  }, [topology, stock, batches, retired]);

  const notify = (msg) => {
    setNotice(msg);
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setNotice(''), 3200);
  };

  const handleApply = (plan) => {
    const result = applyReplacement({ topology, stock, batches, retired, plan });
    setTopology(result.topology);
    setStock(result.stock);
    setBatches(result.batches);
    setRetired(result.retired);
    return result;
  };

  const handleRevoke = (batchId) => {
    const result = revokeBatch({ topology, stock, batches, retired, batchId });
    setTopology(result.topology);
    setStock(result.stock);
    setBatches(result.batches);
    setRetired(result.retired);
  };

  const resetAll = () => {
    if (!window.confirm('恢复初始拓扑并清空备件库存、批次与退役档案？')) return;
    resetState();
    const fresh = loadState();
    setTopology(fresh.topology);
    setStock(fresh.stock);
    setBatches(fresh.batches);
    setRetired(fresh.retired);
    notify('已恢复初始数据');
  };

  const activeCount = batches.filter((b) => b.status !== 'revoked').length;

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
        <nav className="main-nav">
          <button className={page === 'replace' ? 'on' : ''} onClick={() => setPage('replace')}>
            🛠 故障替换台
          </button>
          <button className={page === 'editor' ? 'on' : ''} onClick={() => setPage('editor')}>
            ◳ 拓扑编辑器
          </button>
          <button className={page === 'archive' ? 'on' : ''} onClick={() => setPage('archive')}>
            🗄 备件 / 批次 / 退役{activeCount > 0 && <i className="nav-badge">{activeCount}</i>}
          </button>
        </nav>
        <div className="top-actions">
          <button onClick={resetAll}>重置本机数据</button>
        </div>
      </header>

      <div className={'page-body ' + page}>
        {page === 'editor' && (
          <EditorPage topology={topology} setTopology={setTopology} batches={batches} notify={notify} />
        )}
        {page === 'replace' && (
          <ReplacePage
            topology={topology}
            stock={stock}
            batches={batches}
            retired={retired}
            onApply={handleApply}
            onRevoke={handleRevoke}
            notify={notify}
          />
        )}
        {page === 'archive' && (
          <ArchivePage
            stock={stock}
            setStock={setStock}
            batches={batches}
            retired={retired}
            notify={notify}
          />
        )}
      </div>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
