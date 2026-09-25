import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, Link, Routes, Route } from 'react-router-dom';
import './base.css';

const PublicSite = lazy(() => import('./PublicSite.jsx'));
const AdminApp = lazy(() => import('./AdminApp.jsx'));
const staticSite = import.meta.env.VITE_STATIC_SITE === 'true';
const Router = staticSite ? HashRouter : BrowserRouter;

function StaticAdminNotice() {
  return <main className="boot-screen"><div><b>CCT</b><h1>管理后台仅在安全服务端运行</h1><p>当前永久公开链接为官网展示端，不在静态托管环境暴露管理入口、客户咨询或数据库。</p><Link to="/">返回官网</Link></div></main>;
}

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="boot-screen"><div><b>CCT</b><h1>页面暂时无法显示</h1><p>请刷新后重试，或稍后回来。</p><button onClick={() => window.location.reload()}>重新加载</button></div></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary><Router>
    <Suspense fallback={<div className="boot-screen" role="status"><span>CCT <small>正在连接智能世界</small></span></div>}>
      <Routes><Route path="/admin/*" element={staticSite ? <StaticAdminNotice /> : <AdminApp />} /><Route path="/*" element={<PublicSite />} /></Routes>
    </Suspense>
  </Router></ErrorBoundary></React.StrictMode>
);
