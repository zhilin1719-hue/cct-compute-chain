import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Bell, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, ExternalLink, Eye, FileText, Filter, Globe2, LayoutDashboard, Loader2, LockKeyhole, LogOut, Menu, MessageSquare, MoreHorizontal, Pencil, Plus, RefreshCw, Save, Search, Settings2, ShieldCheck, Sparkles, Trash2, Users, X } from 'lucide-react';
import './admin.css';

const AdminContext = createContext(null);
const useAdmin = () => useContext(AdminContext);
const CONTENT_TYPES = { service: '核心业务', solution: '行业方案', insight: '洞察动态' };
const LEAD_STATUSES = { new: '待处理', contacted: '已联系', qualified: '有效商机', closed: '已关闭' };
const formatDate = (value, full = false) => value ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', ...(full ? { year: 'numeric', hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value)) : '—';
const initials = (name = '') => name.trim().slice(0, 2).toUpperCase() || 'CC';
const emptyContent = { type: 'insight', slug: '', title: '', titleEn: '', summary: '', summaryEn: '', body: '', bodyEn: '', category: '', status: 'draft', featured: false };

function Spinner({ label = '正在加载数据…' }) { return <div className="adm-loading" role="status"><Loader2 size={22} className="adm-spin"/><span>{label}</span></div>; }
function ErrorState({ message, retry }) { return <div className="adm-error" role="alert"><CircleHelp size={21}/><div><strong>暂时无法加载</strong><p>{message || '请检查网络连接后重试。'}</p></div>{retry && <button className="adm-btn adm-btn-secondary" onClick={retry}><RefreshCw size={15}/>重试</button>}</div>; }
function EmptyState({ title = '暂时没有数据', text = '新的记录会显示在这里。', action }) { return <div className="adm-empty"><div className="adm-empty-icon"><FileText size={24}/></div><h3>{title}</h3><p>{text}</p>{action}</div>; }
function Badge({ status }) { const names = { published: '已发布', draft: '草稿', ...LEAD_STATUSES, active: '正常', disabled: '已停用' }; return <span className={`adm-badge adm-badge-${status}`}><i/>{names[status] || status}</span>; }
function Field({ label, required, help, children, className = '' }) { return <label className={`adm-field ${className}`}><span>{label}{required && <b aria-label="必填"> *</b>}</span>{children}{help && <small>{help}</small>}</label>; }
function PageHeading({ eyebrow, title, description, action }) { return <div className="adm-page-heading"><div>{eyebrow && <div className="adm-eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="adm-page-actions">{action}</div>}</div>; }

function Dialog({ title, subtitle, onClose, children, wide = false, drawer = false }) {
  const box = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => box.current?.querySelector('input,select,textarea,button,[tabindex="0"]')?.focus(), 0);
    function keydown(event) {
      if (!box.current || !box.current.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const controls = [...box.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.offsetParent !== null);
        if (!controls.length) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, []);
  return createPortal(<div className={`adm-overlay ${drawer ? 'adm-overlay-drawer' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={box} role="dialog" aria-modal="true" aria-label={title} className={`adm-dialog ${wide ? 'adm-dialog-wide' : ''} ${drawer ? 'adm-drawer' : ''}`}><div className="adm-dialog-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="adm-icon-btn" onClick={onClose} aria-label="关闭窗口"><X size={21}/></button></div>{children}</section></div>, document.body);
}

function ConfirmDialog({ title, text, busy, onClose, onConfirm, confirmLabel = '确认删除' }) { return <Dialog title={title} onClose={() => !busy && onClose()}><div className="adm-dialog-body"><div className="adm-danger-icon"><Trash2 size={24}/></div><p className="adm-confirm-text">{text}</p></div><div className="adm-dialog-footer"><button className="adm-btn adm-btn-secondary" disabled={busy} onClick={onClose}>取消</button><button className="adm-btn adm-btn-danger" disabled={busy} onClick={onConfirm}>{busy ? <Loader2 size={16} className="adm-spin"/> : <Trash2 size={16}/>} {confirmLabel}</button></div></Dialog>; }

function useResource(path) {
  const { api } = useAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api(path).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, path, version]);
  return { data, error, loading, reload };
}

function Pagination({ page, total, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="adm-pagination"><span>共 {total} 条{total > 0 ? ` · 第 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} 条` : ''}</span><div><button className="adm-icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="上一页"><ChevronLeft size={17}/></button><span>{page} / {pages}</span><button className="adm-icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="下一页"><ChevronRight size={17}/></button></div></div>;
}

function Dashboard() {
  const { user } = useAdmin();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useResource('/api/admin/stats');
  const statCards = data ? [
    { label: '内容总数', value: data.contentCount, hint: '业务、方案与洞察内容', icon: FileText, color: 'mint' },
    { label: '已发布内容', value: data.publishedCount, hint: '当前在官网公开展示', icon: Globe2, color: 'blue' },
    { label: '咨询总数', value: data.leadCount, hint: '来自官网的合作咨询', icon: MessageSquare, color: 'purple' },
    { label: '待处理咨询', value: data.newLeadCount, hint: '等待首次联系与跟进', icon: Clock3, color: 'orange' },
  ] : [];
  const days = data?.leadsByDay || [];
  const max = Math.max(1, ...days.map(day => Number(day.count) || 0));
  return <><PageHeading eyebrow="YOUR COMMAND CENTER" title={`欢迎回来，${user.name}`} description="掌握官网内容与合作动态，让每一次连接都有价值。" action={<button className="adm-btn adm-btn-secondary" onClick={reload}><RefreshCw size={16}/>刷新数据</button>}/>
    {loading ? <Spinner/> : error ? <ErrorState message={error} retry={reload}/> : <>
      <div className="adm-stats-grid">{statCards.map(({ label, value, hint, icon: Icon, color }) => <div className="adm-stat-card" key={label}><div className="adm-stat-top"><span>{label}</span><div className={`adm-stat-icon ${color}`}><Icon size={19}/></div></div><strong>{Number(value ?? 0).toLocaleString('zh-CN')}</strong><small>{hint}</small></div>)}</div>
      <div className="adm-dashboard-grid"><section className="adm-panel"><div className="adm-panel-heading"><div><h2>咨询趋势</h2><p>按创建日期统计的官网咨询</p></div><span className="adm-subtle-tag">实际记录</span></div><div className="adm-chart" role="img" aria-label={days.length ? days.map(day => `${day.date}：${day.count} 条咨询`).join('，') : '暂无咨询趋势数据'}>{days.length ? days.map((day, index) => <div className="adm-chart-column" key={day.date}><div className="adm-chart-bar-track"><div className="adm-chart-bar" style={{ height: `${Number(day.count) / max * 100}%`, minHeight: Number(day.count) > 0 ? 5 : 0 }} title={`${day.date} · ${day.count} 条`}><span>{day.count}</span></div></div><small>{days.length <= 14 || index % Math.ceil(days.length / 10) === 0 ? day.date.slice(5).replace('-', '/') : ''}</small></div>) : <EmptyState title="暂无趋势数据" text="官网收到咨询后，这里会自动生成趋势。"/>}</div></section>
      <section className="adm-panel adm-quick-panel"><div className="adm-panel-heading"><div><h2>开始新工作</h2><p>让灵感与业务一起向前</p></div><Sparkles size={21}/></div><button className="adm-quick-action" onClick={() => navigate('/admin/content?new=1')}><span className="adm-quick-icon"><Plus size={21}/></span><span><strong>创建官网内容</strong><small>发布新的业务、方案或洞察</small></span><ArrowUpRight size={19}/></button><button className="adm-quick-action" onClick={() => navigate('/admin/leads?status=new')}><span className="adm-quick-icon purple"><MessageSquare size={20}/></span><span><strong>处理合作咨询</strong><small>{data.newLeadCount > 0 ? `${data.newLeadCount} 条新咨询等待跟进` : '查看咨询记录与跟进状态'}</small></span><ArrowUpRight size={19}/></button><a className="adm-live-card" href="/" target="_blank" rel="noreferrer"><span className="adm-live-dot"/><span><strong>浏览品牌官网</strong><small>检查最新公开页面</small></span><ExternalLink size={18}/></a></section></div>
      <section className="adm-panel"><div className="adm-panel-heading"><div><h2>最新合作咨询</h2><p>保持联系，发现下一次合作机会</p></div><NavLink className="adm-text-link" to="/admin/leads">查看全部<ArrowRight size={16}/></NavLink></div>{data.recentLeads?.length ? <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>联系人 / 企业</th><th>关注领域</th><th>提交时间</th><th>状态</th><th><span className="adm-sr-only">操作</span></th></tr></thead><tbody>{data.recentLeads.map(lead => <tr key={lead.id}><td><div className="adm-person-cell"><span className="adm-small-avatar">{initials(lead.name)}</span><span><strong>{lead.name}</strong><small>{lead.company || lead.email}</small></span></div></td><td>{lead.interest || '未指定'}</td><td className="adm-muted">{formatDate(lead.createdAt, true)}</td><td><Badge status={lead.status}/></td><td><button className="adm-table-action" onClick={() => navigate(`/admin/leads?lead=${encodeURIComponent(lead.id)}`)}>查看<ChevronRight size={15}/></button></td></tr>)}</tbody></table></div> : <EmptyState title="还没有合作咨询" text="访客通过官网提交的咨询将在这里出现。"/>}</section>
    </>}
  </>;
}

function ContentPreview({ item, onClose }) {
  const [language, setLanguage] = useState('zh');
  const en = language === 'en';
  return <Dialog wide title="内容预览" subtitle="预览当前编辑内容；是否公开展示取决于保存后的发布状态。" onClose={onClose}><div className="adm-dialog-body"><div className="adm-segmented"><button className={!en ? 'active' : ''} onClick={() => setLanguage('zh')}>简体中文</button><button className={en ? 'active' : ''} onClick={() => setLanguage('en')}>English</button></div><article className="adm-content-preview"><div className="adm-preview-label">{item.category || CONTENT_TYPES[item.type]}</div><h1>{(en ? item.titleEn : item.title) || '标题尚未填写'}</h1><p className="adm-preview-summary">{(en ? item.summaryEn : item.summary) || '摘要尚未填写'}</p><hr/>{((en ? item.bodyEn : item.body) || '正文尚未填写').split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</article></div></Dialog>;
}

function ContentEditor({ item, onClose, onSaved }) {
  const { api, toast } = useAdmin();
  const [values, setValues] = useState({ ...emptyContent, ...item });
  const [language, setLanguage] = useState('zh');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const en = language === 'en';
  const set = (key, value) => { setValues(prev => ({ ...prev, [key]: value })); setDirty(true); };
  function close() { if (busy) return; if (dirty) setDiscard(true); else onClose(); }
  async function save(event) {
    event.preventDefault();
    const status = event.nativeEvent.submitter?.value || 'draft';
    const requiredFields = [['slug', '页面标识'], ['category', '所属分类'], ['title', '中文标题'], ['summary', '中文摘要'], ['body', '中文正文'], ['titleEn', '英文标题'], ['summaryEn', '英文摘要'], ['bodyEn', '英文正文']];
    const missing = requiredFields.find(([key]) => !String(values[key] || '').trim());
    if (missing) { setLanguage(missing[0].endsWith('En') ? 'en' : 'zh'); setError(`请填写${missing[1]}。中英文内容均需填写后才能保存。`); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) || values.slug.length < 2) { setError('页面标识至少 2 位，只能包含小写英文字母、数字和连字符。'); return; }
    setBusy(true); setError('');
    try {
      const payload = Object.fromEntries(Object.keys(emptyContent).map(key => [key, values[key]]));
      payload.status = status;
      await api(item?.id ? `/api/admin/content/${item.id}` : '/api/admin/content', { method: item?.id ? 'PUT' : 'POST', body: payload });
      toast(status === 'published' ? '内容已发布，官网将展示更新后的内容。' : '内容已保存为草稿。');
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><Dialog title={item?.id ? '编辑内容' : '创建新内容'} subtitle="中英文内容均为必填，可先保存为草稿再发布。" wide onClose={close}><form onSubmit={save}>
    <div className="adm-dialog-body"><div className="adm-editor-meta"><Field label="内容类型"><select value={values.type} onChange={e => set('type', e.target.value)}>{Object.entries(CONTENT_TYPES).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></Field><Field label="所属分类" required><input maxLength={80} value={values.category} onChange={e => set('category', e.target.value)} placeholder="例如：AI 基础设施"/></Field><Field label="页面标识" required help="使用小写英文字母、数字和连字符"><input value={values.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={2} maxLength={100} onChange={e => set('slug', e.target.value)} placeholder="例如：enterprise-ai" aria-required="true"/></Field></div>
      <div className="adm-editor-tabs"><div className="adm-segmented"><button type="button" className={!en ? 'active' : ''} onClick={() => setLanguage('zh')}>简体中文</button><button type="button" className={en ? 'active' : ''} onClick={() => setLanguage('en')}>English</button></div><label className="adm-checkbox"><input type="checkbox" checked={Boolean(values.featured)} onChange={e => set('featured', e.target.checked)}/><span>首页推荐</span></label></div>
      <div className="adm-form-stack"><Field label={en ? '英文标题' : '中文标题'} required><input autoComplete="off" maxLength={en ? 200 : 160} value={en ? values.titleEn : values.title} onChange={e => set(en ? 'titleEn' : 'title', e.target.value)} placeholder={en ? 'A clear, compelling title' : '输入清晰、有吸引力的标题'} aria-required="true"/></Field><Field label={en ? '英文摘要' : '中文摘要'} required help="用于列表卡片与内容导读，建议保持简洁。"><textarea rows={3} maxLength={en ? 1000 : 600} value={en ? values.summaryEn : values.summary} onChange={e => set(en ? 'summaryEn' : 'summary', e.target.value)} placeholder={en ? 'Introduce the value of this content…' : '用一段话介绍这篇内容的核心价值…'}/></Field><Field label={en ? '英文正文' : '中文正文'} required help="以纯文本保存，空行划分段落；不执行 HTML 或脚本。"><textarea rows={10} maxLength={en ? 60000 : 40000} value={en ? values.bodyEn : values.body} onChange={e => set(en ? 'bodyEn' : 'body', e.target.value)} placeholder={en ? 'Write your content here…' : '开始撰写正文…'}/></Field></div>
      {error && <div className="adm-inline-error" role="alert">{error}</div>}
    </div><div className="adm-dialog-footer adm-editor-footer"><button type="button" className="adm-btn adm-btn-secondary" onClick={() => setPreview(true)}><Eye size={16}/>预览</button><div><button type="submit" value="draft" disabled={busy} className="adm-btn adm-btn-secondary"><Save size={16}/>{values.status === 'published' ? '转为草稿' : '保存草稿'}</button><button type="submit" value="published" disabled={busy} className="adm-btn adm-btn-primary">{busy ? <Loader2 size={16} className="adm-spin"/> : <Globe2 size={16}/>}发布内容</button></div></div>
  </form></Dialog>{preview && <ContentPreview item={values} onClose={() => setPreview(false)}/>} {discard && <ConfirmDialog title="放弃未保存的修改？" text="此次编辑尚未保存。离开后，这些修改将丢失。" confirmLabel="放弃修改" onClose={() => setDiscard(false)} onConfirm={onClose}/>}</>;
}

function ContentPage() {
  const { api, toast } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useResource('/api/admin/content');
  const [q, setQ] = useState(''); const [type, setType] = useState('all'); const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1); const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (new URLSearchParams(location.search).get('new') === '1') { setEditing({}); navigate('/admin/content', { replace: true }); } }, [location.search, navigate]);
  useEffect(() => setPage(1), [q, type, status]);
  const all = data?.items || [];
  const filtered = all.filter(item => (type === 'all' || item.type === type) && (status === 'all' || item.status === status) && `${item.title} ${item.titleEn} ${item.slug} ${item.category}`.toLowerCase().includes(q.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  async function remove() { setBusy(true); try { await api(`/api/admin/content/${deleting.id}`, { method: 'DELETE' }); toast('内容已删除。'); setDeleting(null); reload(); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); } }
  return <><PageHeading eyebrow="CONTENT STUDIO" title="内容管理" description="以清晰、有价值的内容，连接品牌与每一位访客。" action={<button className="adm-btn adm-btn-primary" onClick={() => setEditing({})}><Plus size={17}/>创建内容</button>}/>
    <section className="adm-panel"><div className="adm-content-tabs">{[['all', '全部内容'], ...Object.entries(CONTENT_TYPES)].map(([key, label]) => <button key={key} className={type === key ? 'active' : ''} onClick={() => setType(key)}>{label}<span>{key === 'all' ? all.length : all.filter(item => item.type === key).length}</span></button>)}</div><div className="adm-toolbar"><label className="adm-search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索标题、标识或分类" aria-label="搜索内容"/>{q && <button onClick={() => setQ('')} aria-label="清除搜索"><X size={15}/></button>}</label><label className="adm-filter-select"><Filter size={15}/><select value={status} onChange={e => setStatus(e.target.value)} aria-label="筛选发布状态"><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select></label></div>
      {loading ? <Spinner/> : error ? <ErrorState message={error} retry={reload}/> : filtered.length ? <><div className="adm-table-wrap"><table className="adm-table adm-content-table"><thead><tr><th>内容标题</th><th>类型 / 分类</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 8, currentPage * 8).map(item => <tr key={item.id}><td><button className="adm-title-button" onClick={() => setEditing(item)}>{item.title}{item.featured && <span className="adm-featured-label">推荐</span>}</button><small className="adm-table-subtitle">{item.slug}</small></td><td><strong className="adm-cell-normal">{CONTENT_TYPES[item.type] || item.type}</strong><small className="adm-table-subtitle">{item.category || '未分类'}</small></td><td><Badge status={item.status}/></td><td className="adm-muted">{formatDate(item.updatedAt, true)}</td><td><div className="adm-row-actions"><button className="adm-icon-btn" aria-label={`编辑 ${item.title}`} title="编辑内容" onClick={() => setEditing(item)}><Pencil size={16}/></button><button className="adm-icon-btn adm-danger-hover" aria-label={`删除 ${item.title}`} title="删除内容" onClick={() => setDeleting(item)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div><Pagination page={currentPage} total={filtered.length} pageSize={8} onPage={setPage}/></> : <EmptyState title={all.length ? '没有找到匹配的内容' : '创建你的第一篇内容'} text={all.length ? '试着调整关键词或筛选条件。' : '从业务介绍、行业方案或品牌洞察开始。'} action={!all.length && <button className="adm-btn adm-btn-primary" onClick={() => setEditing({})}><Plus size={16}/>创建内容</button>}/>}</section>
      {editing && <ContentEditor item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }}/>} {deleting && <ConfirmDialog title="删除这篇内容？" text={`“${deleting.title}”将从内容库中删除；如果已发布，也将不再在官网展示。此操作无法撤销。`} busy={busy} onClose={() => setDeleting(null)} onConfirm={remove}/>}
  </>;
}

function LeadDrawer({ lead, onClose, onSaved }) {
  const { api, toast } = useAdmin(); const [status, setStatus] = useState(lead.status); const [notes, setNotes] = useState(lead.notes || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save(event) { event.preventDefault(); setBusy(true); setError(''); try { await api(`/api/admin/leads/${lead.id}`, { method: 'PATCH', body: { status, notes } }); toast('跟进记录已保存。'); onSaved(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <Dialog drawer title="合作咨询详情" subtitle={`提交于 ${formatDate(lead.createdAt, true)}`} onClose={() => !busy && onClose()}><form onSubmit={save}><div className="adm-dialog-body"><div className="adm-lead-profile"><span className="adm-large-avatar">{initials(lead.name)}</span><div><h3>{lead.name}</h3><p>{lead.company || '未填写企业名称'}</p></div><Badge status={lead.status}/></div><dl className="adm-detail-list"><div><dt>电子邮箱</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd></div><div><dt>关注领域</dt><dd>{lead.interest || '未指定'}</dd></div><div><dt>咨询编号</dt><dd className="adm-monospace">{lead.id}</dd></div></dl><section className="adm-inquiry-message"><h4>咨询内容</h4><p>{lead.message || '未填写具体咨询内容。'}</p></section><div className="adm-section-divider"/><h3 className="adm-form-section-title">跟进管理</h3><div className="adm-form-stack"><Field label="跟进状态"><select value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(LEAD_STATUSES).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></Field><Field label="内部跟进备注" help="仅后台成员可见，不会发送给咨询人。"><textarea rows={7} maxLength={10000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="记录沟通进展、业务需求与下一步安排…"/></Field></div>{error && <div className="adm-inline-error" role="alert">{error}</div>}</div><div className="adm-dialog-footer"><button className="adm-btn adm-btn-secondary" type="button" disabled={busy} onClick={onClose}>关闭</button><button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="adm-spin"/> : <Save size={16}/>}保存跟进</button></div></form></Dialog>;
}

function LeadsPage() {
  const location = useLocation(); const navigate = useNavigate(); const parameters = new URLSearchParams(location.search);
  const [status, setStatus] = useState(parameters.get('status') || ''); const [q, setQ] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState(null);
  useEffect(() => { const timer = setTimeout(() => setSearch(q), 300); return () => clearTimeout(timer); }, [q]);
  useEffect(() => setPage(1), [status, search]);
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (search) query.set('q', search);
  const { data, loading, error, reload } = useResource(`/api/admin/leads?${query.toString()}`);
  const items = data?.items || []; const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / 10)));
  useEffect(() => { const id = new URLSearchParams(location.search).get('lead'); if (id && data) { const lead = data.items.find(item => String(item.id) === id); if (lead) setSelected(lead); navigate('/admin/leads', { replace: true }); } }, [data, location.search, navigate]);
  return <><PageHeading eyebrow="BUSINESS CONNECTIONS" title="合作咨询" description="将每一条业务意向，转化为有进展的真实连接。" action={<button className="adm-btn adm-btn-secondary" onClick={reload}><RefreshCw size={16}/>刷新</button>}/><section className="adm-panel"><div className="adm-content-tabs">{[['', '全部咨询'], ...Object.entries(LEAD_STATUSES)].map(([key, label]) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label}</button>)}</div><div className="adm-toolbar"><label className="adm-search"><Search size={17}/><input value={q} maxLength={200} onChange={e => setQ(e.target.value)} placeholder="搜索联系人、企业或邮箱" aria-label="搜索合作咨询"/>{q && <button onClick={() => setQ('')} aria-label="清除搜索"><X size={15}/></button>}</label><span className="adm-muted adm-small">咨询来自官网合作表单</span></div>{loading ? <Spinner/> : error ? <ErrorState message={error} retry={reload}/> : items.length ? <><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>联系人 / 企业</th><th>电子邮箱</th><th>关注领域</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead><tbody>{items.slice((currentPage - 1) * 10, currentPage * 10).map(lead => <tr key={lead.id}><td><div className="adm-person-cell"><span className="adm-small-avatar">{initials(lead.name)}</span><span><strong>{lead.name}</strong><small>{lead.company || '未填写企业'}</small></span></div></td><td>{lead.email}</td><td>{lead.interest || '未指定'}</td><td><Badge status={lead.status}/></td><td className="adm-muted">{formatDate(lead.createdAt, true)}</td><td><button className="adm-table-action" onClick={() => setSelected(lead)}>跟进<ArrowUpRight size={15}/></button></td></tr>)}</tbody></table></div><Pagination page={currentPage} total={items.length} pageSize={10} onPage={setPage}/></> : <EmptyState title={search || status ? '没有找到匹配的咨询' : '还没有收到合作咨询'} text={search || status ? '调整关键词或跟进状态后再试。' : '访客提交官网合作表单后，记录会自动出现在这里。'}/>}</section>{selected && <LeadDrawer key={selected.id} lead={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); reload(); }}/>}</>;
}

function SettingsPage() {
  const { api, toast } = useAdmin(); const { data, loading, error, reload } = useResource('/api/admin/settings'); const [values, setValues] = useState(null); const [busy, setBusy] = useState(false); const [saveError, setSaveError] = useState('');
  useEffect(() => { if (data) setValues(data.settings); }, [data]);
  const set = (key, value) => setValues(prev => ({ ...prev, [key]: value }));
  async function save(event) { event.preventDefault(); setBusy(true); setSaveError(''); try { const settings = Object.fromEntries(['brandName', 'heroTitle', 'heroTitleEn', 'heroSubtitle', 'heroSubtitleEn', 'contactEmail'].map(key => [key, values[key] || ''])); await api('/api/admin/settings', { method: 'PUT', body: settings }); toast('网站设置已更新。'); reload(); } catch (err) { setSaveError(err.message); } finally { setBusy(false); } }
  return <><PageHeading eyebrow="BRAND SETTINGS" title="网站设置" description="统一品牌信息与首页表达，让每一个触点保持一致。"/>{loading ? <Spinner/> : error ? <ErrorState message={error} retry={reload}/> : values && <form onSubmit={save} className="adm-settings-form"><section className="adm-panel"><div className="adm-panel-heading"><div><h2>品牌与联系信息</h2><p>公开显示在官网中的基本品牌信息</p></div><Globe2 size={20}/></div><div className="adm-panel-body adm-form-grid"><Field label="品牌名称" required><input required maxLength={100} value={values.brandName || ''} onChange={e => set('brandName', e.target.value)}/></Field><Field label="公开联系邮箱" required><input required type="email" maxLength={254} value={values.contactEmail || ''} onChange={e => set('contactEmail', e.target.value)}/></Field></div></section><section className="adm-panel"><div className="adm-panel-heading"><div><h2>首页品牌表达</h2><p>分别维护中文与英文首页的标题和简介</p></div><Sparkles size={20}/></div><div className="adm-panel-body adm-form-stack"><div className="adm-form-grid"><Field label="中文主标题" required><textarea required rows={3} maxLength={200} value={values.heroTitle || ''} onChange={e => set('heroTitle', e.target.value)}/></Field><Field label="英文主标题" required><textarea required rows={3} maxLength={200} value={values.heroTitleEn || ''} onChange={e => set('heroTitleEn', e.target.value)}/></Field></div><div className="adm-form-grid"><Field label="中文品牌简介" required><textarea required rows={4} maxLength={1000} value={values.heroSubtitle || ''} onChange={e => set('heroSubtitle', e.target.value)}/></Field><Field label="英文品牌简介" required><textarea required rows={4} maxLength={1500} value={values.heroSubtitleEn || ''} onChange={e => set('heroSubtitleEn', e.target.value)}/></Field></div></div></section>{saveError && <div className="adm-inline-error" role="alert">{saveError}</div>}<div className="adm-save-bar"><p><ShieldCheck size={16}/>保存后将更新官网的公开展示内容</p><button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="adm-spin"/> : <Save size={16}/>}保存设置</button></div></form>}</>;
}

function UserEditor({ item, onClose, onSaved }) {
  const { api, toast, user } = useAdmin(); const [values, setValues] = useState({ name: item?.name || '', email: item?.email || '', role: item?.role || 'editor', active: item ? Boolean(item.active) : true, password: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const editing = Boolean(item?.id); const self = item?.id === user.id; const set = (key, value) => setValues(prev => ({ ...prev, [key]: value }));
  async function save(event) { event.preventDefault(); setBusy(true); setError(''); try { const body = editing ? { name: values.name, role: values.role, active: values.active, ...(values.password ? { password: values.password } : {}) } : { name: values.name, email: values.email, role: values.role, password: values.password }; await api(editing ? `/api/admin/users/${item.id}` : '/api/admin/users', { method: editing ? 'PATCH' : 'POST', body }); toast(editing ? '成员信息已更新。' : '新成员已创建。'); onSaved(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <Dialog title={editing ? '编辑成员' : '添加团队成员'} subtitle="按实际工作职责分配访问权限。" onClose={() => !busy && onClose()}><form onSubmit={save}><div className="adm-dialog-body adm-form-stack"><Field label="成员姓名" required><input required autoComplete="name" maxLength={80} value={values.name} onChange={e => set('name', e.target.value)}/></Field><Field label="登录邮箱" required help={editing ? '登录邮箱创建后不可通过此表单修改。' : ''}><input type="email" required disabled={editing} autoComplete="username" maxLength={254} value={values.email} onChange={e => set('email', e.target.value)}/></Field><Field label="成员角色" help="编辑可管理内容与咨询；管理员还可管理设置、成员和审计记录。"><select disabled={self} value={values.role} onChange={e => set('role', e.target.value)}><option value="editor">编辑</option><option value="admin">管理员</option></select></Field><Field label={editing ? '重置密码（选填）' : '初始密码'} required={!editing} help={editing ? '留空保留原密码。设置新密码后，该成员需要重新登录。' : '密码至少 12 位。请通过安全渠道告知成员。'}><input type="password" minLength={12} maxLength={128} autoComplete="new-password" required={!editing} value={values.password} onChange={e => set('password', e.target.value)} placeholder={editing ? '留空则不修改' : '至少 12 位字符'}/></Field>{editing && <label className="adm-checkbox"><input type="checkbox" disabled={self} checked={values.active} onChange={e => set('active', e.target.checked)}/><span>允许此成员登录{self ? '（当前账户）' : ''}</span></label>}{error && <div className="adm-inline-error" role="alert">{error}</div>}</div><div className="adm-dialog-footer"><button type="button" disabled={busy} className="adm-btn adm-btn-secondary" onClick={onClose}>取消</button><button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="adm-spin"/> : <Check size={16}/>} {editing ? '保存更改' : '创建成员'}</button></div></form></Dialog>;
}

function UsersPage() {
  const { user } = useAdmin(); const { data, loading, error, reload } = useResource('/api/admin/users'); const [q, setQ] = useState(''); const [editing, setEditing] = useState(null); const items = (data?.items || []).filter(item => `${item.name} ${item.email}`.toLowerCase().includes(q.toLowerCase()));
  return <><PageHeading eyebrow="PEOPLE & ACCESS" title="团队成员" description="让合适的人拥有合适的权限，共同维护品牌体验。" action={<button className="adm-btn adm-btn-primary" onClick={() => setEditing({})}><Plus size={17}/>添加成员</button>}/><div className="adm-info-banner"><ShieldCheck size={19}/><span>管理员可以管理全部内容与系统设置。编辑仅可管理官网内容、合作咨询与自己的账户。</span></div><section className="adm-panel"><div className="adm-toolbar"><label className="adm-search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} aria-label="搜索成员" placeholder="搜索姓名或邮箱"/></label><span className="adm-muted adm-small">{data?.items?.length ?? '—'} 位团队成员</span></div>{loading ? <Spinner/> : error ? <ErrorState message={error} retry={reload}/> : items.length ? <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>成员</th><th>登录邮箱</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="adm-person-cell"><span className="adm-small-avatar">{initials(item.name)}</span><strong>{item.name}{item.id === user.id && <span className="adm-self-tag">你</span>}</strong></div></td><td>{item.email}</td><td><span className="adm-role-label">{item.role === 'admin' ? <ShieldCheck size={14}/> : <Pencil size={14}/>} {item.role === 'admin' ? '管理员' : '编辑'}</span></td><td><Badge status={item.active ? 'active' : 'disabled'}/></td><td><button className="adm-table-action" onClick={() => setEditing(item)}>编辑<Pencil size={14}/></button></td></tr>)}</tbody></table></div> : <EmptyState title="没有找到匹配的成员" text="尝试使用其他姓名或邮箱搜索。"/>}</section>{editing && <UserEditor item={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }}/>}</>;
}

const ACTION_NAMES = { 'content.created': '创建内容', 'content.updated': '更新内容', 'content.deleted': '删除内容', 'lead.updated': '更新咨询', 'settings.updated': '更新网站设置', 'user.created': '添加成员', 'user.updated': '更新成员', 'auth.password_changed': '修改密码', login: '登录后台', logout: '退出登录', create: '创建', update: '更新', delete: '删除', 'content.create': '创建内容', 'content.update': '更新内容', 'content.delete': '删除内容', 'lead.update': '更新咨询', 'settings.update': '更新网站设置', 'user.create': '添加成员', 'user.update': '更新成员', 'password.change': '修改密码', 'auth.login': '登录后台', 'auth.logout': '退出登录', 'auth.password': '修改密码' };
function auditDescription(details) {
  if (!details || (typeof details === 'object' && !Object.keys(details).length)) return '—';
  if (typeof details !== 'object') return String(details);
  const fieldNames = { brandName: '品牌名称', heroTitle: '中文主标题', heroTitleEn: '英文主标题', heroSubtitle: '中文品牌简介', heroSubtitleEn: '英文品牌简介', contactEmail: '公开联系邮箱', name: '成员姓名', role: '角色', active: '登录状态' };
  return Object.entries(details).map(([key, value]) => {
    if (key === 'fields') return `修改字段：${value.map(field => fieldNames[field] || field).join('、')}`;
    if (key === 'slug') return `页面标识：${value}`;
    if (key === 'status') return `状态：${LEAD_STATUSES[value] || ({ published: '已发布', draft: '草稿' })[value] || value}`;
    if (key === 'previousStatus') return `原状态：${LEAD_STATUSES[value] || ({ published: '已发布', draft: '草稿' })[value] || value}`;
    if (key === 'notesUpdated') return value ? '已更新跟进备注' : '';
    if (key === 'passwordReset') return value ? '已重置密码' : '';
    if (key === 'role') return `角色：${value === 'admin' ? '管理员' : '编辑'}`;
    if (key === 'email') return `邮箱：${value}`;
    return `${key}：${typeof value === 'object' ? JSON.stringify(value) : value}`;
  }).filter(Boolean).join('；') || '—';
}
const ENTITY_NAMES = { content: '官网内容', lead: '合作咨询', settings: '网站设置', user: '团队成员', auth: '账户', session: '登录会话' };
function AuditPage() {
  const { data, loading, error, reload } = useResource('/api/admin/audit'); const [q, setQ] = useState(''); const [page, setPage] = useState(1); useEffect(() => setPage(1), [q]);
  const items = (data?.items || []).filter(item => `${item.actorEmail || ''} ${item.action} ${ACTION_NAMES[item.action] || ''} ${item.entityType} ${typeof item.details === 'object' ? JSON.stringify(item.details) : item.details || ''}`.toLowerCase().includes(q.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / 12)));
  return <><PageHeading eyebrow="ACTIVITY & ACCOUNTABILITY" title="操作记录" description="追踪关键变更，为团队协作保留清晰的操作依据。" action={<button className="adm-btn adm-btn-secondary" onClick={reload}><RefreshCw size={16}/>刷新</button>}/><section className="adm-panel"><div className="adm-toolbar"><label className="adm-search"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} aria-label="搜索操作记录" placeholder="搜索操作人、动作或详情"/></label><span className="adm-muted adm-small">最近 200 条 · 只读审计记录</span></div>{loading ? <Spinner/> : error ? <ErrorState message={error} retry={reload}/> : items.length ? <><div className="adm-table-wrap"><table className="adm-table adm-audit-table"><thead><tr><th>操作时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th></tr></thead><tbody>{items.slice((currentPage - 1) * 12, currentPage * 12).map((item, i) => <tr key={item.id || `${item.createdAt}-${i}`}><td className="adm-muted">{formatDate(item.createdAt, true)}</td><td>{item.actorEmail || '系统'}</td><td><span className="adm-audit-action">{ACTION_NAMES[item.action] || item.action}</span></td><td>{ENTITY_NAMES[item.entityType] || item.entityType || '—'}{item.entityId && <small className="adm-table-subtitle adm-monospace">{item.entityId}</small>}</td><td className="adm-audit-detail">{auditDescription(item.details)}</td></tr>)}</tbody></table></div><Pagination page={currentPage} total={items.length} pageSize={12} onPage={setPage}/></> : <EmptyState title={q ? '没有找到匹配的记录' : '暂时没有操作记录'} text={q ? '调整关键词后重试。' : '团队完成关键操作后，记录会出现在这里。'}/>}</section></>;
}

function AccountPage() {
  const { api, user, toast } = useAdmin(); const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save(event) { event.preventDefault(); if (newPassword !== confirmation) { setError('两次输入的新密码不一致。'); return; } setBusy(true); setError(''); try { await api('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } }); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); toast('密码已更新。'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <><PageHeading eyebrow="YOUR ACCOUNT" title="个人账户" description="管理登录凭证，让每一次访问都保持安全。"/><div className="adm-account-grid"><section className="adm-panel adm-account-card"><span className="adm-large-avatar">{initials(user.name)}</span><h2>{user.name}</h2><p>{user.email}</p><span className="adm-role-label"><ShieldCheck size={15}/>{user.role === 'admin' ? '管理员' : '编辑'}</span><div className="adm-section-divider"/><p className="adm-small adm-muted">账户基础信息由管理员在团队成员中维护。</p></section><section className="adm-panel"><div className="adm-panel-heading"><div><h2>修改登录密码</h2><p>使用至少 12 位字符的新密码</p></div><LockKeyhole size={20}/></div><form onSubmit={save}><div className="adm-panel-body adm-form-stack"><Field label="当前密码" required><input type="password" required autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></Field><Field label="新密码" required><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少 12 位字符"/></Field><Field label="确认新密码" required><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="再次输入新密码"/></Field>{error && <div className="adm-inline-error" role="alert">{error}</div>}</div><div className="adm-dialog-footer"><button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="adm-spin"/> : <LockKeyhole size={16}/>}更新密码</button></div></form></section></div></>;
}

function Brand({ small = false }) { return <div className={`adm-brand ${small ? 'adm-brand-small' : ''}`}><span className="adm-brand-symbol"><i/><i/><i/></span><span>CCT<span className="adm-brand-sub">{small ? '算链集团' : 'COMPUTE CHAIN'}</span></span></div>; }

function Login({ onLogin, notice }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [showPassword, setShowPassword] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || '登录失败，请检查账号与密码。'); onLogin(payload); } catch (err) { setError(err.message || '暂时无法连接服务器，请稍后重试。'); } finally { setBusy(false); } }
  return <div className="adm-login"><aside className="adm-login-visual"><a href="/" aria-label="返回 CCT 官网"><Brand/></a><div className="adm-orbital-art" aria-hidden="true"><div className="adm-orbit adm-orbit-one"/><div className="adm-orbit adm-orbit-two"/><div className="adm-orbit adm-orbit-three"/><div className="adm-orbit-core"><span>CCT</span></div><i className="adm-orbit-node node-one"/><i className="adm-orbit-node node-two"/><i className="adm-orbit-node node-three"/></div><div className="adm-login-statement"><span>CONNECTED INTELLIGENCE</span><h1>连接计算的力量。<br/>让未来，即刻发生。</h1><p>CCT 算链集团 · 品牌与业务管理平台</p></div><div className="adm-login-footer"><span>© {new Date().getFullYear()} CCT 算链集团</span><span>COMPUTE · CONNECT · TRANSFORM</span></div></aside><main className="adm-login-main"><div className="adm-login-mobile-brand"><Brand small/></div><div className="adm-login-form-wrap"><div className="adm-login-lock"><LockKeyhole size={24}/></div><div className="adm-eyebrow">CCT WORKSPACE</div><h2>欢迎回来</h2><p className="adm-login-description">登录工作台，管理品牌与每一次业务连接。</p>{notice && <div className="adm-info-banner adm-login-notice" role="status">{notice}</div>}<form onSubmit={submit} className="adm-form-stack"><Field label="工作邮箱" required><input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="请输入管理员分配的邮箱"/></Field><Field label="登录密码" required><div className="adm-password-input"><input type={showPassword ? 'text' : 'password'} required maxLength={128} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入登录密码"/><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}><Eye size={18}/></button></div></Field>{error && <div className="adm-inline-error" role="alert">{error}</div>}<button className="adm-btn adm-btn-primary adm-login-submit" disabled={busy}>{busy ? <Loader2 size={18} className="adm-spin"/> : '登录工作台'}{!busy && <ArrowRight size={18}/>}</button></form><div className="adm-login-help"><ShieldCheck size={16}/><span>仅限授权成员使用。忘记密码请联系管理员。</span></div><a className="adm-login-back" href="/"><ArrowDownLeft size={16}/>返回品牌官网</a></div><span className="adm-login-bottom">CCT BRAND & BUSINESS WORKSPACE</span></main></div>;
}

const MAIN_NAV = [{ path: '/admin', label: '概览工作台', icon: LayoutDashboard, exact: true }, { path: '/admin/content', label: '内容管理', icon: FileText }, { path: '/admin/leads', label: '合作咨询', icon: MessageSquare }];
const SYSTEM_NAV = [{ path: '/admin/settings', label: '网站设置', icon: Settings2 }, { path: '/admin/users', label: '团队成员', icon: Users }, { path: '/admin/audit', label: '操作记录', icon: ShieldCheck }];
function AdminShell({ logout }) {
  const { user } = useAdmin(); const location = useLocation(); const [mobileOpen, setMobileOpen] = useState(false); const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => { function onKey(event) { if (event.key === 'Escape') setMobileOpen(false); } document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, []);
  const current = [...MAIN_NAV, ...SYSTEM_NAV, { path: '/admin/account', label: '个人账户' }].find(item => item.path === location.pathname)?.label || '概览工作台';
  async function signOut() { setLoggingOut(true); try { await logout(); } finally { setLoggingOut(false); } }
  const navItem = item => <NavLink key={item.path} to={item.path} end={item.exact} className={({ isActive }) => `adm-nav-link ${isActive ? 'active' : ''}`}><item.icon size={19}/><span>{item.label}</span>{item.path === '/admin' && <span className="adm-nav-dot"/>}</NavLink>;
  return <div className="adm-app">{mobileOpen && <button className="adm-mobile-backdrop" aria-label="关闭导航菜单" onClick={() => setMobileOpen(false)}/>}<aside className={`adm-sidebar ${mobileOpen ? 'is-open' : ''}`}><a href="/admin" className="adm-sidebar-brand" aria-label="CCT 管理工作台"><Brand small/></a><div className="adm-workspace-chip"><span className="adm-workspace-icon"><Globe2 size={16}/></span><div><strong>品牌管理工作台</strong><small>CCT WORKSPACE</small></div><ShieldCheck size={16}/></div><nav aria-label="管理后台导航"><div className="adm-nav-label">工作空间</div>{MAIN_NAV.map(navItem)}{user.role === 'admin' && <><div className="adm-nav-label adm-nav-label-system">管理与设置</div>{SYSTEM_NAV.map(navItem)}</>}</nav><div className="adm-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer" className="adm-sidebar-site"><Globe2 size={17}/><span>访问品牌官网</span><ExternalLink size={15}/></a><div className="adm-sidebar-account"><NavLink to="/admin/account" aria-label="打开个人账户"><span className="adm-sidebar-avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.role === 'admin' ? '管理员' : '内容编辑'}</small></span></NavLink><button title="退出登录" aria-label="退出登录" disabled={loggingOut} onClick={signOut}>{loggingOut ? <Loader2 size={17} className="adm-spin"/> : <LogOut size={17}/>}</button></div></div></aside><div className="adm-main-layout"><header className="adm-topbar"><div className="adm-breadcrumb"><button className="adm-icon-btn adm-mobile-menu" aria-label="打开导航菜单" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}><Menu size={21}/></button><span>工作台</span><ChevronRight size={14}/><strong>{current}</strong></div><div className="adm-topbar-right"><span className="adm-topbar-workspace"><span/>CCT Workspace</span><NavLink to="/admin/account" className="adm-topbar-avatar" aria-label="个人账户">{initials(user.name)}</NavLink></div></header><main className="adm-main" id="admin-main"><Routes><Route index element={<Dashboard/>}/><Route path="content" element={<ContentPage/>}/><Route path="leads" element={<LeadsPage/>}/><Route path="settings" element={user.role === 'admin' ? <SettingsPage/> : <Navigate to="/admin" replace/>}/><Route path="users" element={user.role === 'admin' ? <UsersPage/> : <Navigate to="/admin" replace/>}/><Route path="audit" element={user.role === 'admin' ? <AuditPage/> : <Navigate to="/admin" replace/>}/><Route path="account" element={<AccountPage/>}/><Route path="*" element={<Navigate to="/admin" replace/>}/></Routes><footer className="adm-main-footer"><span>CCT 算链集团 · 管理工作台</span><span>让每一次连接创造价值</span></footer></main></div></div>;
}

export default function AdminApp() {
  const [session, setSession] = useState(null); const [loading, setLoading] = useState(true); const [bootstrapError, setBootstrapError] = useState(''); const [notice, setNotice] = useState(''); const [notifications, setNotifications] = useState([]); const timers = useRef([]);
  const toast = useCallback((message, type = 'success') => { const id = `${Date.now()}-${Math.random()}`; setNotifications(list => [...list.slice(-3), { id, message, type }]); timers.current.push(setTimeout(() => setNotifications(list => list.filter(item => item.id !== id)), 5500)); }, []);
  const bootstrap = useCallback(async () => { setLoading(true); setBootstrapError(''); try { const response = await fetch('/api/auth/me', { credentials: 'same-origin' }); if (response.status === 401) { setSession(null); return; } const data = await response.json(); if (!response.ok) throw new Error(data.error || '无法确认登录状态。'); setSession(data); } catch (err) { setBootstrapError(err.message); } finally { setLoading(false); } }, []);
  useEffect(() => { bootstrap(); document.title = 'CCT 算链集团 · 管理工作台'; document.documentElement.classList.add('cct-admin-root'); document.body.classList.add('cct-admin-body'); return () => { timers.current.forEach(clearTimeout); document.documentElement.classList.remove('cct-admin-root'); document.body.classList.remove('cct-admin-body'); }; }, [bootstrap]);
  const api = useCallback(async (path, options = {}) => {
    const method = options.method || 'GET';
    const response = await fetch(path, { method, credentials: 'same-origin', headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': session?.csrfToken || '' } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
    let payload; try { payload = await response.json(); } catch { throw new Error('服务器返回了无法读取的响应，请稍后重试。'); }
    if (response.status === 401) { setNotice('登录已失效，请重新登录后继续工作。'); setSession(null); throw new Error('登录已失效。'); }
    if (!response.ok) throw new Error(payload.error || '操作失败，请稍后重试。');
    return payload;
  }, [session?.csrfToken]);
  async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); setSession(null); setNotice('你已安全退出工作台。'); } catch (err) { toast(err.message, 'error'); } }
  if (loading) return <div className="adm-bootstrap"><Brand small/><Spinner label="正在连接工作台…"/></div>;
  if (bootstrapError) return <div className="adm-bootstrap"><Brand small/><ErrorState message={bootstrapError} retry={bootstrap}/><a className="adm-text-link" href="/">返回品牌官网<ArrowRight size={16}/></a></div>;
  if (!session?.user) return <Login notice={notice} onLogin={data => { setSession(data); setNotice(''); }}/>;
  return <AdminContext.Provider value={{ user: session.user, api, toast }}><a className="adm-skip-link" href="#admin-main">跳转到主要内容</a><AdminShell logout={logout}/><div className="adm-toast-stack" aria-live="polite" aria-atomic="false">{notifications.map(item => <div key={item.id} className={`adm-toast ${item.type === 'error' ? 'adm-toast-error' : ''}`} role={item.type === 'error' ? 'alert' : 'status'}>{item.type === 'error' ? <CircleHelp size={19}/> : <CheckCircle2 size={19}/>}<span>{item.message}</span><button aria-label="关闭提示" onClick={() => setNotifications(list => list.filter(note => note.id !== item.id))}><X size={16}/></button></div>)}</div></AdminContext.Provider>;
}
