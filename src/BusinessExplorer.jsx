import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bot, Building2, Check, Clapperboard, Cpu, Database, Globe2, Landmark, Layers3, Megaphone, Printer, Radar, Search, ShieldCheck, ShoppingBag, Workflow } from 'lucide-react';
import './business.css';

const text = (lang, pair) => pair[lang === 'en' ? 1 : 0];
const stages = {
  CORE: ['基础能力', 'Foundations'],
  GROWTH: ['增长业务', 'Growth business'],
  PILOT: ['创新业务', 'Innovation'],
  REVIEW: ['生态合作', 'Ecosystem partnership'],
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
    id: 'public-services', stage: 'PILOT', icon: Building2, code: '07 / PUBLIC SERVICES',
    name: ['AI 公共服务', 'AI public services'],
    tagline: ['让政策、办事与公共资源更容易获得。', 'Make public information and services easier to access.'],
    description: ['面向政务咨询、政策匹配、办事导引、材料预审和公共资源服务，先建立权威知识库，再通过人工复核和全程留痕提升服务效率。', 'Support public enquiries, policy matching, service guidance, document pre-checks and public resources through authoritative knowledge, human review and complete records.'],
    capabilities: [['政策知识库与智能问答', 'Policy knowledge & assisted answers'], ['材料预审、智能导办与派单', 'Document pre-checks, guidance & routing'], ['权限、审计、脱敏与人工复核', 'Access, audit, redaction & human review']],
    use: ['政务大厅 / 园区服务 / 公共事业 / 医疗教育便民服务', 'Government service / Parks / Utilities / Health and education access'],
    businessModel: ['项目建设费 + 年度运营服务 + 按调用量结算', 'Implementation + managed service + usage-based fees'],
    start: ['选择一个高频事项，整理政策、流程、表单和人工转接规则，做 6—8 周受控试点。', 'Select one high-volume service, organize policy, process, forms and human handoff rules, then run a 6–8 week controlled pilot.'],
    boundary: ['涉及行政审批、医疗、教育、社保等高影响结果时，AI 只提供辅助，最终决定由有权人员作出。', 'AI assists while authorized people retain final authority for approvals, health, education, social benefits and other consequential outcomes.'],
    links: [['ai-public-services', 'AI 公共服务解决方案', 'AI public service solution'], ['market-signal-ai-public-services-2026', '公共服务市场与政策信号', 'Public-service market signal']],
  },
  {
    id: 'ai-series', stage: 'GROWTH', icon: Clapperboard, code: '08 / AI ENTERTAINMENT',
    name: ['AI 漫剧与短剧', 'AI comics & short drama'],
    tagline: ['把一个故事，变成可持续运营的内容资产。', 'Turn a story into an operated content asset.'],
    description: ['覆盖选题、剧本、分镜、角色设定、画面与视频生成、配音、字幕、多语言本地化和渠道发行，面向国内平台与海外短视频市场。', 'Cover concepts, scripts, storyboards, characters, image and video generation, dubbing, subtitles, localization and distribution for domestic and international platforms.'],
    capabilities: [['剧本、分镜与角色资产管理', 'Script, storyboard & character assets'], ['漫剧、短剧、配音与多语言版本', 'Comics, short drama, dubbing & localization'], ['版权审核、渠道测试与数据复盘', 'Rights review, channel tests & analytics']],
    use: ['漫剧工作室 / 短剧出海 / 品牌故事 / IP 孵化', 'Comic studios / Short-drama export / Brand stories / IP incubation'],
    businessModel: ['制作服务 + 内容分成 + IP 授权 + 海外发行运营', 'Production fees + revenue share + IP licensing + international distribution'],
    start: ['用 1 个故事完成 3 集样片和中英文版本，以完播率、单集成本和付费转化决定是否扩量。', 'Produce three pilot episodes plus Chinese and English versions, then scale only after completion, unit-cost and paid-conversion review.'],
    boundary: ['人物肖像、音乐、字体、素材和训练来源必须获得授权；上线前完成人工内容审核与平台合规检查。', 'Likeness, music, fonts, media and training sources require authorization. Human editorial and platform compliance review precede release.'],
    links: [['ai-series-studio', 'AI 漫剧与短剧工作室', 'AI comics & short-drama studio'], ['market-signal-ai-video-2026', 'AI 视频商业化信号', 'AI video market signal']],
  },
  {
    id: 'foreign-trade', stage: 'GROWTH', icon: Globe2, code: '09 / AI GLOBAL TRADE',
    name: ['AI 外贸', 'AI foreign trade'],
    tagline: ['从找客户，到形成可跟进的海外商机。', 'From prospecting to qualified international opportunities.'],
    description: ['围绕目标市场、买家研究、产品资料、多语言询盘、报价准备和跟进节奏，帮助外贸团队减少重复工作并保留业务判断。', 'Support market research, buyer discovery, multilingual enquiries, quotation preparation and follow-up while preserving commercial judgment.'],
    capabilities: [['市场、买家与竞争情报研究', 'Market, buyer & competitor research'], ['多语言产品资料与询盘辅助', 'Multilingual product and enquiry support'], ['线索评分、跟进任务与 CRM 协同', 'Lead scoring, follow-up & CRM coordination']],
    use: ['制造企业出海 / B2B 获客 / 展会线索 / 海外经销商开发', 'Manufacturing export / B2B sales / Trade-show leads / Distributor development'],
    businessModel: ['部署服务 + 按账号订阅 + 合格线索运营服务', 'Implementation + subscriptions + qualified-lead operations'],
    start: ['选定一个国家和一条产品线，导入合规产品资料与历史询盘，验证线索有效率和销售跟进时间。', 'Choose one country and product line, load approved product material and historical enquiries, then measure qualified leads and sales time.'],
    boundary: ['AI 不代替出口管制、制裁、海关、税务、合同和产品认证审查；报价与对外承诺必须由业务负责人批准。', 'AI does not replace export-control, sanctions, customs, tax, contract or certification review. Commercial owners approve quotations and commitments.'],
    links: [['ai-foreign-trade', 'AI 外贸增长系统', 'AI foreign-trade growth'], ['market-signal-ai-cross-border-2026', '跨境商业化信号', 'Cross-border market signal']],
  },
  {
    id: 'cross-border-commerce', stage: 'GROWTH', icon: ShoppingBag, code: '10 / CROSS-BORDER COMMERCE',
    name: ['AI 跨境电商', 'AI cross-border commerce'],
    tagline: ['让一个商品，更快适配多个市场。', 'Adapt one product to multiple markets faster.'],
    description: ['连接选品研究、商品知识、多语言页面、广告素材、客服、订单和售后，按国家、平台与品牌规则建立可复核的运营流程。', 'Connect product research, catalog data, multilingual listings, media, service, orders and after-sales through market and platform-specific rules.'],
    capabilities: [['选品、定价与本地竞争研究', 'Product, price & local competition research'], ['多语言商品页与广告素材', 'Multilingual listings & advertising media'], ['客服、订单、库存与售后协同', 'Service, orders, inventory & after-sales']],
    use: ['独立站 / Amazon / AliExpress / TikTok Shop / 区域平台', 'DTC / Amazon / AliExpress / TikTok Shop / Regional marketplaces'],
    businessModel: ['店铺运营费 + 软件订阅 + 经确认的销售服务费', 'Store operations + software subscription + agreed sales service fee'],
    start: ['选择 10—30 个 SKU 和一个目标市场，先验证上架效率、广告成本、转化率、退款率和毛利。', 'Select 10–30 SKUs and one market, then validate listing speed, acquisition cost, conversion, returns and gross margin.'],
    boundary: ['平台规则、税务、知识产权、产品安全、消费者权益和本地仓配均需逐市场确认；不承诺销量或利润。', 'Platform rules, tax, IP, product safety, consumer rights and local logistics require market-by-market review. Sales or profit are not guaranteed.'],
    links: [['ai-cross-border-commerce', 'AI 跨境电商运营', 'AI cross-border commerce operations'], ['market-signal-ai-cross-border-2026', '跨境商业化信号', 'Cross-border market signal']],
  },
  {
    id: 'additive-manufacturing', stage: 'PILOT', icon: Printer, code: '11 / ADDITIVE MANUFACTURING',
    name: ['3D 打印与按需制造', '3D printing & on-demand manufacturing'],
    tagline: ['从数字模型，到高价值小批量制造。', 'From digital model to high-value production.'],
    description: ['结合 AI 辅助设计、拓扑优化、报价排产、打印参数和质量追溯，聚焦医疗、航空航天、工业备件和定制化制造。', 'Combine AI-assisted design, topology optimization, quotation, scheduling, process parameters and traceability for medical, aerospace, industrial spares and customization.'],
    capabilities: [['AI 辅助设计与可制造性检查', 'AI-assisted design & manufacturability'], ['材料、工艺、报价与排产协同', 'Materials, process, quoting & scheduling'], ['检测、批次追溯与质量记录', 'Inspection, batch traceability & quality records']],
    use: ['医疗器械 / 航空航天 / 工装夹具 / 备件与定制产品', 'Medical / Aerospace / Tooling / Spares and customization'],
    businessModel: ['设计服务 + 打印制造费 + 材料耗材 + 年度生产协同服务', 'Design + print production + materials + managed manufacturing service'],
    start: ['选择一个高价值、低批量零件，对比现有交期、总成本、性能和认证要求后再决定试制。', 'Select one high-value low-volume part and compare lead time, total cost, performance and certification before a trial build.'],
    boundary: ['医疗、航空航天和安全关键零件必须遵守材料、设备、工艺、检测与行业认证要求；AI 建议不能替代工程签字。', 'Medical, aerospace and safety-critical parts require qualified materials, equipment, process, inspection and certification. AI does not replace engineering sign-off.'],
    links: [['additive-manufacturing', '3D 打印与按需制造方案', 'Additive manufacturing solution'], ['market-signal-additive-manufacturing-2026', '增材制造市场信号', 'Additive manufacturing signal']],
  },
  {
    id: 'creator-economy', stage: 'GROWTH', icon: Megaphone, code: '12 / CREATOR ECONOMY',
    name: ['AI 自媒体与品牌内容', 'AI creator & brand media'],
    tagline: ['把选题、制作、分发和变现连成内容生意。', 'Connect ideas, production, distribution and monetization.'],
    description: ['围绕个人 IP、企业账号和矩阵运营，建立选题库、脚本、图文视频、数字人、多平台分发、评论线索和商业合作管理。', 'Build topic libraries, scripts, visual media, digital presenters, multi-platform distribution, audience leads and brand partnerships for creator and corporate accounts.'],
    capabilities: [['选题、脚本与内容资产库', 'Topics, scripts & content assets'], ['图文视频、数字人与多平台改编', 'Media, digital presenters & repurposing'], ['粉丝线索、商单与效果复盘', 'Audience leads, brand deals & performance']],
    use: ['个人 IP / 企业号 / 专家内容 / 矩阵账号 / 海外频道', 'Personal IP / Brand accounts / Expert media / Account networks / Global channels'],
    businessModel: ['内容代运营 + 工具订阅 + 广告商单 + 电商与知识产品转化', 'Managed content + subscription + brand deals + commerce and knowledge products'],
    start: ['围绕一个垂直主题连续发布 30 天，验证有效播放、留资、获客成本、内容成本和可持续产能。', 'Publish around one niche for 30 days and measure qualified views, leads, acquisition cost, content cost and sustainable output.'],
    boundary: ['不制造虚假身份、虚假销量或未经授权的数字人；广告、带货、医疗金融等内容按平台与监管要求标识和审核。', 'Do not create deceptive identities, fake sales or unauthorized digital humans. Advertising, commerce, health and finance content require proper disclosure and review.'],
    links: [['ai-creator-economy', 'AI 自媒体与品牌内容系统', 'AI creator and brand media'], ['market-signal-creator-economy-2025', '创作者商业化信号', 'Creator-economy signal']],
  },
  {
    id: 'low-altitude', stage: 'PILOT', icon: Radar, code: '13 / LOW-ALTITUDE SYSTEMS',
    name: ['低空经济', 'Low-altitude systems'],
    tagline: ['从受控验证，探索空地协同。', 'Explore coordinated systems through pilots.'],
    description: ['探索任务资料管理、设备状态汇聚与资源调度辅助，先验证数据链路与运营责任，再推进现场集成。', 'Explore mission information, device-status aggregation and scheduling assistance. Validate data paths and operating accountability before field integration.'],
    capabilities: [['任务资料与设备状态管理', 'Mission information & device status'], ['身份认证与运营数据分析', 'Device identity & operational analytics'], ['故障回退与人员协同', 'Fallback & operator coordination']],
    use: ['任务协同 / 设备网络 / 运营数据分析', 'Mission coordination / Device networks / Operational analytics'],
    boundary: ['实际飞行与现场安全由具备相应资质的专业运营人员控制。', 'Qualified operators retain control of flight and field safety.'],
    links: [['low-altitude-ecosystem', '低空经济与分布式网络', 'Low-altitude & distributed networks'], ['trusted-data', '可信数据与协作', 'Trusted data & collaboration']],
  },
  {
    id: 'robotics', stage: 'PILOT', icon: Bot, code: '14 / PHYSICAL INTELLIGENCE',
    name: ['AI 机器人', 'AI robotics'],
    tagline: ['在物理世界，验证智能的边界。', 'Validate intelligence in the physical world.'],
    description: ['围绕数字孪生、工业视觉、边缘推理和机器人接口开展联合验证，从仿真走向受控现场。', 'Jointly validate digital twins, industrial vision, edge inference and robot interfaces, progressing from simulation to controlled field tests.'],
    capabilities: [['仿真、视觉与边缘推理', 'Simulation, vision & edge inference'], ['任务规划与机器人接口', 'Task planning & robot interfaces'], ['安全围栏、接管与失败回退', 'Safety boundaries, handoff & fallback']],
    use: ['工业视觉 / 设备协同 / 具身智能联合实验', 'Industrial vision / Equipment coordination / Physical AI pilots'],
    boundary: ['现场应用须先完成安全评估、操作权限和人员接管方案。', 'Field use requires safety assessment, operating permissions and a human takeover plan.'],
    links: [['physical-ai-lab', '具身智能联合实验室', 'Physical AI joint lab'], ['industrial-intelligence', '产业智能与设备协同', 'Industrial intelligence']],
  },
  {
    id: 'capital', stage: 'REVIEW', icon: Landmark, code: '15 / ECOSYSTEM & CAPITAL',
    name: ['算力金融与资本协同', 'Compute finance & capital'],
    tagline: ['连接产业资源，探索长期协同。', 'Connect industry resources for long-term collaboration.'],
    description: ['围绕算力资源、产业需求与资本协同条件，连接法务、财务与产业伙伴开展合作研究。', 'Connect legal, finance and industry partners to study collaboration around compute resources and industry demand.'],
    capabilities: [['业务模式与责任主体研究', 'Business-model & accountability research'], ['资源权属、计量与风险识别', 'Resource ownership, metering & risk review'], ['法务、财务与资质专业审核', 'Legal, financial & qualification review']],
    use: ['生态研究 / 合作边界讨论 / 专业审核', 'Ecosystem research / Scope discussion / Expert review'],
    boundary: ['相关合作须完成法务、财务与资质审核；不构成金融产品、投资招揽、融资或收益承诺。', 'Collaboration requires legal, financial and qualification review and does not constitute a financial product, investment solicitation, funding or return commitment.'],
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
      <header className="cct-business-heading"><div><Heading id={`${unique}-title`}>{text(lang, ['十五大方向，一张产业智能地图。', 'Fifteen directions. One connected AI ecosystem.'])}</Heading></div><p>{text(lang, ['从算力和数据底座，到公共服务、内容、外贸、跨境电商与智能制造。选择一个方向，了解能做什么、如何形成收入，以及合作从哪里开始。', 'From compute and data foundations to public services, media, global trade, cross-border commerce and intelligent manufacturing. Choose a direction to see the offer, revenue path and first step.'])}</p></header>
      {!compact && <div className="cct-business-stage-note"><ShieldCheck size={17} aria-hidden="true"/><p>{text(lang, ['选择业务方向，查看能力、适用场景、商业模式与合作起点。', 'Choose a direction to explore capabilities, use cases, commercial models and the first step.'])}</p></div>}
      <div className="cct-business-filters" role="group" aria-label={text(lang, ['按规划类别筛选', 'Filter by planning category'])}>{['ALL', ...Object.keys(stages)].map(stage => <button key={stage} type="button" aria-pressed={filter === stage} onClick={() => selectFilter(stage)}>{stage === 'ALL' ? text(lang, ['全部方向', 'All directions']) : text(lang, stages[stage])}</button>)}</div>
      <div className="cct-business-workspace">
        <div className="cct-business-map" role="group" aria-label={text(lang, ['选择业务方向', 'Choose a business direction'])}>{items.map(item => { const ItemIcon = item.icon; return <button key={item.id} type="button" className={`cct-business-node ${selected.id === item.id ? 'is-selected' : ''}`} aria-pressed={selected.id === item.id} aria-controls={`${unique}-detail`} onClick={() => setSelectedId(item.id)}><span className="cct-business-node-top"><ItemIcon size={25} strokeWidth={1.5} aria-hidden="true"/></span><strong>{text(lang, item.name)}</strong><span className="cct-business-node-bottom"><small>{text(lang, stages[item.stage])}</small>{selected.id === item.id ? <Check size={16} aria-hidden="true"/> : <ArrowUpRight size={16} aria-hidden="true"/>}</span></button>; })}</div>
        <article className="cct-business-detail" id={`${unique}-detail`} aria-labelledby={`${unique}-detail-title`}>
          <div className="cct-business-detail-top"><span className="cct-business-detail-icon"><Icon size={26} strokeWidth={1.4} aria-hidden="true"/></span><span className={`cct-business-stage cct-business-stage-${selected.stage.toLowerCase()}`}>{text(lang, stages[selected.stage])}</span></div>
          <h3 id={`${unique}-detail-title`}>{text(lang, selected.tagline)}</h3><p className="cct-business-description">{text(lang, selected.description)}</p>
          <ul className="cct-business-capabilities">{selected.capabilities.map((pair,i) => <li key={i}><Check size={15} aria-hidden="true"/>{text(lang, pair)}</li>)}</ul>
          <div className="cct-business-use"><span>{text(lang, ['适用场景', 'Potential applications'])}</span><p>{text(lang, selected.use)}</p></div>
          {selected.businessModel && <div className="cct-business-model"><span>{text(lang, ['常见商业模式', 'Typical business model'])}</span><p>{text(lang, selected.businessModel)}</p></div>}
          {selected.start && <div className="cct-business-start"><span>{text(lang, ['建议从这一步开始', 'Recommended first step'])}</span><p>{text(lang, selected.start)}</p></div>}
          <div className="cct-business-boundary"><ShieldCheck size={17} aria-hidden="true"/><div><span>{text(lang, ['合作说明', 'Engagement note'])}</span><p>{text(lang, selected.boundary)}</p></div></div>
          {relatedLinks.length > 0 && <div className="cct-business-related"><span>{text(lang, ['深入了解', 'Explore related content'])}</span>{relatedLinks.map(([slug,zh,en]) => <Link to={`/content/${slug}`} key={slug}>{text(lang,[zh,en])}<ArrowUpRight size={16} aria-hidden="true"/></Link>)}</div>}
          <Link className="cct-business-cta" to={selected.stage === 'REVIEW' ? '/ecosystem' : `/contact?interest=${encodeURIComponent(text(lang, selected.name))}`}>{selected.stage === 'REVIEW' ? text(lang, ['了解生态协作', 'Explore ecosystem collaboration']) : text(lang, ['讨论这一方向', 'Discuss this direction'])}<ArrowRight size={17} aria-hidden="true"/></Link>
        </article>
      </div>
      <span className="cct-business-sr-only" role="status">{text(lang,['当前选择：','Selected: '])}{text(lang,selected.name)}</span>
      {compact && <div className="cct-business-more"><Link to="/business">{text(lang,['查看完整集团业务地图','Explore the full business atlas'])}<ArrowUpRight size={17} aria-hidden="true"/></Link></div>}
    </div>
  </section>;
}
