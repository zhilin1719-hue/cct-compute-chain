import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bot, Check, Cpu, Database, Landmark, Layers3, Radar, Search, ShieldCheck, ShoppingBag, Workflow } from 'lucide-react';
import './business.css';

const text = (lang, pair) => pair[lang === 'en' ? 1 : 0];
const stages = {
  CORE: ['核心能力方向', 'Core capability'],
  GROWTH: ['增长应用方向', 'Growth application'],
  PILOT: ['联合试点方向', 'Joint pilot'],
  REVIEW: ['待专业审核方向', 'Subject to review'],
};
// This map describes portfolio directions; it deliberately excludes unverified operating claims.
const businesses = [
  {
    id: 'compute', stage: 'CORE', icon: Cpu, code: '01 / INFRASTRUCTURE',
    name: ['AI 算力网络', 'AI compute network'],
    tagline: ['为智能生产，建立计算底座。', 'The compute foundation for AI workloads.'],
    description: ['围绕模型负载、数据边界与单位任务成本，规划从推理网关到算能协同的基础设施。', 'Plan infrastructure from inference gateways to compute-energy coordination around workloads, data boundaries and cost per task.'],
    capabilities: [['多模型路由与统一推理', 'Model routing & unified inference'], ['资源调度、配额与成本归集', 'Scheduling, quotas & cost allocation'], ['私有部署、容量与故障回退', 'Private deployment, capacity & fallback']],
    use: ['推理服务 / 企业专有 AI / 算力容量规划', 'Inference serving / Private AI / Capacity planning'],
    boundary: ['供应、芯片适配、区域、容量与服务水平，以资源合同和技术验收为准。', 'Supply, accelerator support, regions, capacity and service levels require resource contracts and technical acceptance.'],
    links: [['inference-fabric', '推理基础设施与 FinOps', 'Inference fabric & FinOps'], ['private-ai', '私有 AI 与数据主权', 'Private AI & data sovereignty'], ['green-compute', '算能协同与容量治理', 'Compute-energy coordination']],
  },
  {
    id: 'agents', stage: 'CORE', icon: Workflow, code: '02 / INTELLIGENT WORK',
    name: ['AI 智能体', 'AI agents'],
    tagline: ['从一次回答，到一个完整任务。', 'From an answer to a complete task.'],
    description: ['将知识、工具与业务系统连接为可追踪的工作流，明确每个智能体的权限、责任与人工交接点。', 'Connect knowledge, tools and business systems into traceable workflows with explicit permissions, ownership and human handoffs.'],
    capabilities: [['工具白名单与任务编排', 'Tool allowlists & orchestration'], ['知识检索与业务系统协同', 'Retrieval & business-system integration'], ['评测、追踪、预算与人工接管', 'Evaluation, tracing, budgets & handoff']],
    use: ['客户服务 / 企业协作 / 工单与 CRM 辅助', 'Customer service / Collaboration / Ticket & CRM assistance'],
    boundary: ['外部写入、交易、承诺及高影响动作需明确审批；自动化效果通过试点评测。', 'External writes, transactions, commitments and consequential actions need explicit approvals. Outcomes require pilot evaluation.'],
    links: [['agent-systems', '智能体与工作流', 'Agents & intelligent workflows'], ['customer-operations-agents', '客户运营智能体', 'Customer operations agents'], ['ai-control-plane', '智能体治理控制平面', 'AI & agent control plane']],
  },
  {
    id: 'industry', stage: 'CORE', icon: Layers3, code: '03 / INDUSTRY SYSTEMS',
    name: ['AI 产业平台', 'AI industry platforms'],
    tagline: ['让 AI 进入产业的真实流程。', 'Bring AI into operational workflows.'],
    description: ['以现场问题与组织目标为起点，连接行业知识、设备数据和运营系统，逐步形成可评测的应用平台。', 'Start with operational problems and organizational goals. Connect domain knowledge, equipment data and business systems into measurable applications.'],
    capabilities: [['业务流程诊断与场景优先级', 'Workflow discovery & prioritization'], ['设备知识、维护与运营辅助', 'Equipment knowledge & operations assistance'], ['行业评测集与分阶段验收', 'Domain evaluation & staged acceptance']],
    use: ['工业协同 / 企业转型 / 教育与人才发展', 'Industrial operations / Transformation / Education & workforce'],
    boundary: ['生产控制、教学评价、成绩及人事等高影响决定保留专业人员最终判断。', 'Qualified people retain final authority over production control, teaching evaluation, grades and employment decisions.'],
    links: [['industrial-intelligence', '产业智能与设备协同', 'Industrial intelligence'], ['ai-transformation', '企业 AI 转型', 'Enterprise AI transformation'], ['education-intelligence', '教育与人才发展', 'Education & workforce development']],
  },
  {
    id: 'knowledge', stage: 'CORE', icon: Database, code: '04 / TRUSTED KNOWLEDGE',
    name: ['数据与知识平台', 'Data & knowledge'],
    tagline: ['让知识可用，让依据可追溯。', 'Make knowledge useful and traceable.'],
    description: ['从授权、质量和版本开始治理数据，建立按岗位权限检索、有来源引用的企业知识与协作基础。', 'Govern data through authorization, quality and versioning. Build enterprise knowledge with role-based retrieval and source references.'],
    capabilities: [['数据目录、分级与权限继承', 'Catalogs, classification & inherited access'], ['知识索引、来源引用与版本管理', 'Indexing, citations & versioning'], ['跨组织协作与审计留痕', 'Cross-organization collaboration & audit']],
    use: ['企业知识检索 / 报告辅助 / 多方数据协作', 'Knowledge retrieval / Report assistance / Data collaboration'],
    boundary: ['先确认数据权属、授权与保留期限；存证或上链不代表数据本身真实或合规。', 'Confirm ownership, authorization and retention first. Evidence recording or a ledger does not itself establish accuracy or compliance.'],
    links: [['trusted-data', '可信数据与协作', 'Trusted data & collaboration'], ['enterprise-knowledge', '企业知识与经营协同', 'Enterprise knowledge & operations'], ['private-ai', '私有 AI 与数据主权', 'Private AI & data sovereignty']],
  },
  {
    id: 'commerce', stage: 'GROWTH', icon: ShoppingBag, code: '05 / AI COMMERCE',
    name: ['AI 电商', 'AI commerce'],
    tagline: ['连接商品、内容与客户运营。', 'Connect products, content and customers.'],
    description: ['以商品数据和品牌规则为基础，编排内容制作、渠道适配、客服辅助与订单协同。', 'Use product data and brand rules to orchestrate content, channel adaptation, customer service and order coordination.'],
    capabilities: [['商品知识与多渠道内容生产', 'Product knowledge & channel content'], ['事实、版权与品牌审核', 'Fact, copyright & brand review'], ['订单协同与关键动作审批', 'Order coordination & action approvals']],
    use: ['商品内容 / 营销协同 / 客服与订单辅助', 'Product content / Campaign coordination / Service & order support'],
    boundary: ['价格、库存、退款等关键变更保留人工批准与回滚；增长效果需对照基线验证。', 'Pricing, inventory and refunds retain human approval and rollback. Growth outcomes require a measured comparison baseline.'],
    links: [['ai-commerce-operations', 'AI 电商与内容运营', 'AI commerce & content operations'], ['customer-operations-agents', '客户运营智能体', 'Customer operations agents']],
  },
  {
    id: 'geo', stage: 'GROWTH', icon: Search, code: '06 / GENERATIVE DISCOVERY',
    name: ['GEO 智能增长', 'GEO growth intelligence'],
    tagline: ['在生成式搜索中，理解品牌位置。', 'Understand your brand in generative search.'],
    description: ['通过可重复的问题集测量品牌出现、来源引用和内容缺口，把诊断、编辑与复测串联起来。', 'Use repeatable question sets to measure brand presence, citations and content gaps, then connect diagnosis, editing and remeasurement.'],
    capabilities: [['品牌可见度与引用诊断', 'Visibility & citation diagnosis'], ['内容缺口与品牌实体一致性', 'Content gaps & entity consistency'], ['问题集、时间窗与复测证据', 'Question sets, time windows & evidence']],
    use: ['品牌内容 / 生成式搜索诊断 / 专业知识表达', 'Brand content / Generative search analysis / Expert knowledge'],
    boundary: ['结果随模型、地区与时间变化；不承诺固定排名、永久引用或确定性增长。', 'Results vary by model, region and time. No fixed rankings, permanent citations or guaranteed growth are promised.'],
    links: [['geo-growth-intelligence', 'GEO 增长智能系统', 'GEO growth intelligence'], ['trusted-data', '可信数据与协作', 'Trusted data & collaboration']],
  },
  {
    id: 'low-altitude', stage: 'PILOT', icon: Radar, code: '07 / LOW-ALTITUDE SYSTEMS',
    name: ['低空经济', 'Low-altitude systems'],
    tagline: ['从受控验证，探索空地协同。', 'Explore coordinated systems through pilots.'],
    description: ['探索任务资料管理、设备状态汇聚与资源调度辅助，先验证数据链路与运营责任，再推进现场集成。', 'Explore mission information, device-status aggregation and scheduling assistance. Validate data paths and operating accountability before field integration.'],
    capabilities: [['任务资料与设备状态管理', 'Mission information & device status'], ['身份认证与运营数据分析', 'Device identity & operational analytics'], ['故障回退与人员协同', 'Fallback & operator coordination']],
    use: ['任务协同 / 设备网络 / 运营数据分析', 'Mission coordination / Device networks / Operational analytics'],
    boundary: ['联合试点方向，不表示持有飞行或运营资质；实际飞行与现场安全由专业运营人员控制。', 'A joint-pilot direction, not a claim of flight or operating qualifications. Qualified operators control flight and field safety.'],
    links: [['low-altitude-ecosystem', '低空经济与分布式网络', 'Low-altitude & distributed networks'], ['trusted-data', '可信数据与协作', 'Trusted data & collaboration']],
  },
  {
    id: 'robotics', stage: 'PILOT', icon: Bot, code: '08 / PHYSICAL INTELLIGENCE',
    name: ['AI 机器人', 'AI robotics'],
    tagline: ['在物理世界，验证智能的边界。', 'Validate intelligence in the physical world.'],
    description: ['围绕数字孪生、工业视觉、边缘推理和机器人接口开展联合验证，从仿真走向受控现场。', 'Jointly validate digital twins, industrial vision, edge inference and robot interfaces, progressing from simulation to controlled field tests.'],
    capabilities: [['仿真、视觉与边缘推理', 'Simulation, vision & edge inference'], ['任务规划与机器人接口', 'Task planning & robot interfaces'], ['安全围栏、接管与失败回退', 'Safety boundaries, handoff & fallback']],
    use: ['工业视觉 / 设备协同 / 具身智能联合实验', 'Industrial vision / Equipment coordination / Physical AI pilots'],
    boundary: ['联合试点与生态共建方向，不代表机器人量产、现场资质或规模化收入。', 'A joint-pilot and ecosystem direction, not a claim of manufacturing capacity, field qualifications or scaled revenue.'],
    links: [['physical-ai-lab', '具身智能联合实验室', 'Physical AI joint lab'], ['industrial-intelligence', '产业智能与设备协同', 'Industrial intelligence']],
  },
  {
    id: 'capital', stage: 'REVIEW', icon: Landmark, code: '09 / ECOSYSTEM & CAPITAL',
    name: ['算力金融与资本协同', 'Compute finance & capital'],
    tagline: ['以专业审核为前提，探索协同。', 'Explore collaboration through expert review.'],
    description: ['作为集团生态研究方向，讨论算力资源、产业需求与资本协作的连接条件。当前页面仅说明研究与审核边界。', 'An ecosystem research direction examining conditions that connect compute resources, industry needs and capital collaboration. This page describes research and review boundaries only.'],
    capabilities: [['业务模式与责任主体研究', 'Business-model & accountability research'], ['资源权属、计量与风险识别', 'Resource ownership, metering & risk review'], ['法务、财务与资质专业审核', 'Legal, financial & qualification review']],
    use: ['生态研究 / 合作边界讨论 / 专业审核', 'Ecosystem research / Scope discussion / Expert review'],
    boundary: ['待专业审核，不构成金融产品、投资招揽、融资承诺或收益承诺；不展示未经核验的融资、估值和回报数字。', 'Subject to expert review. This is not a financial product, investment solicitation, funding commitment or return promise. Unverified financing, valuations and returns are excluded.'],
    links: [['governance-by-design', '了解治理与责任原则', 'Governance & accountability principles']],
  },
];

export default function BusinessExplorer({ lang = 'zh', compact = false, content = [] }) {
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState('compute');
  const unique = useId();
  const items = businesses.filter(item => filter === 'ALL' || item.stage === filter);
  const selected = items.find(item => item.id === selectedId) || items[0];
  const Icon = selected.icon;
  const publishedSlugs = new Set(content.map(item => item.slug));
  const relatedLinks = selected.links.filter(([slug]) => publishedSlugs.has(slug));
  const Heading = compact ? 'h2' : 'h1';
  const selectFilter = stage => { setFilter(stage); setSelectedId(businesses.find(item => stage === 'ALL' || item.stage === stage).id); };
  return <section className={`cct-business ${compact ? 'cct-business-compact' : 'cct-business-full'}`} aria-labelledby={`${unique}-title`}>
    <div className="cct-business-inner">
      <header className="cct-business-heading"><div><span className="cct-business-eyebrow">CCT / BUSINESS ATLAS</span><Heading id={`${unique}-title`}>{text(lang, ['九大方向，一张产业智能地图。', 'Nine directions. One connected AI ecosystem.'])}</Heading></div><p>{text(lang, ['从算力与数据底座，到智能体、产业应用与前沿协同。选择一个方向，了解能力、适用场景与合作边界。', 'From compute and data to agents, industry applications and emerging collaboration. Choose a direction to explore capabilities, use cases and boundaries.'])}</p></header>
      <div className="cct-business-stage-note"><ShieldCheck size={17} aria-hidden="true"/><p>{text(lang, ['以下为业务规划分类与能力说明，不代表已交付规模或成熟业绩。项目范围需经集团确认、需求评估与合同约定。', 'These are portfolio planning categories and capability descriptions, not delivered scale or proven operating results. Scope requires group confirmation, assessment and contract agreement.'])}</p></div>
      <div className="cct-business-filters" role="group" aria-label={text(lang, ['按规划类别筛选', 'Filter by planning category'])}>{['ALL', ...Object.keys(stages)].map(stage => <button key={stage} type="button" aria-pressed={filter === stage} onClick={() => selectFilter(stage)}><span>{stage === 'ALL' ? text(lang, ['全部方向', 'All directions']) : stage}</span><small>{stage === 'ALL' ? '09' : String(businesses.filter(item => item.stage === stage).length).padStart(2, '0')}</small></button>)}</div>
      <div className="cct-business-workspace">
        <div className="cct-business-map" role="group" aria-label={text(lang, ['选择业务方向', 'Choose a business direction'])}>{items.map(item => { const ItemIcon = item.icon; return <button key={item.id} type="button" className={`cct-business-node ${selected.id === item.id ? 'is-selected' : ''}`} aria-pressed={selected.id === item.id} aria-controls={`${unique}-detail`} onClick={() => setSelectedId(item.id)}><span className="cct-business-node-top"><ItemIcon size={25} strokeWidth={1.5} aria-hidden="true"/><span>{item.code.slice(0,2)}</span></span><strong>{text(lang, item.name)}</strong><span className="cct-business-node-bottom"><small>{item.stage}</small>{selected.id === item.id ? <Check size={16} aria-hidden="true"/> : <ArrowUpRight size={16} aria-hidden="true"/>}</span></button>; })}</div>
        <article className="cct-business-detail" id={`${unique}-detail`} aria-labelledby={`${unique}-detail-title`}>
          <div className="cct-business-detail-top"><span className="cct-business-detail-icon"><Icon size={26} strokeWidth={1.4} aria-hidden="true"/></span><span className={`cct-business-stage cct-business-stage-${selected.stage.toLowerCase()}`}>{selected.stage} · {text(lang, stages[selected.stage])}</span></div>
          <span className="cct-business-detail-code">{selected.code}</span><h3 id={`${unique}-detail-title`}>{text(lang, selected.tagline)}</h3><p className="cct-business-description">{text(lang, selected.description)}</p>
          <ul className="cct-business-capabilities">{selected.capabilities.map((pair,i) => <li key={i}><Check size={15} aria-hidden="true"/>{text(lang, pair)}</li>)}</ul>
          <div className="cct-business-use"><span>{text(lang, ['适用场景', 'Potential applications'])}</span><p>{text(lang, selected.use)}</p></div>
          <div className="cct-business-boundary"><ShieldCheck size={17} aria-hidden="true"/><p>{text(lang, selected.boundary)}</p></div>
          {relatedLinks.length > 0 && <div className="cct-business-related"><span>{text(lang, ['深入了解', 'Explore related content'])}</span>{relatedLinks.map(([slug,zh,en]) => <Link to={`/content/${slug}`} key={slug}>{text(lang,[zh,en])}<ArrowUpRight size={16} aria-hidden="true"/></Link>)}</div>}
          <Link className="cct-business-cta" to={selected.stage === 'REVIEW' ? '/ecosystem' : `/contact?interest=${encodeURIComponent(text(lang, selected.name))}`}>{selected.stage === 'REVIEW' ? text(lang, ['了解生态协作', 'Explore ecosystem collaboration']) : text(lang, ['讨论这一方向', 'Discuss this direction'])}<ArrowRight size={17} aria-hidden="true"/></Link>
        </article>
      </div>
      <div className="cct-business-legend">{Object.entries(stages).map(([stage,label])=><span key={stage}><i className={`cct-business-legend-${stage.toLowerCase()}`}/><b>{stage}</b>{text(lang,label)}</span>)}</div>
      <span className="cct-business-sr-only" role="status">{text(lang,['当前选择：','Selected: '])}{text(lang,selected.name)}</span>
      {compact && <div className="cct-business-more"><Link to="/business">{text(lang,['查看完整集团业务地图','Explore the full business atlas'])}<ArrowUpRight size={17} aria-hidden="true"/></Link></div>}
    </div>
  </section>;
}
