export const agentTemplates = [
  {
    id: 'operations',
    code: 'OPS-01',
    name: '运营智能体',
    nameEn: 'Operations agent',
    description: '把客户服务和内部协作中的重复工作，整理成清晰的执行步骤。',
    descriptionEn: 'Turn repetitive service and collaboration work into an executable, reviewable workflow.',
    inputLabel: '业务流程、知识资料、服务规则',
    inputLabelEn: 'Workflow, knowledge and service rules',
    outputLabel: '任务队列、回复草案、人工接管点',
    outputLabelEn: 'Task queue, response drafts and human handoffs',
    steps: ['识别任务意图与完成标准', '检索已授权知识并保留来源', '生成下一步动作与回复草案', '高风险动作进入人工确认', '记录结果、异常与复盘指标'],
    stepsEn: ['Identify intent and completion criteria', 'Retrieve authorized knowledge with sources', 'Prepare the next action and response', 'Route high-risk actions to human approval', 'Record outcomes, exceptions and review metrics'],
    checks: ['事实与来源复核', '外部承诺人工确认', '个人信息最小化'],
    checksEn: ['Fact and source review', 'Human approval for external commitments', 'Data minimization'],
  },
  {
    id: 'growth',
    code: 'GROWTH-02',
    name: '增长智能体',
    nameEn: 'Growth agent',
    description: '围绕内容、客户触点和市场增长，制定可验证的行动计划。',
    descriptionEn: 'Create a research, production, review and measurement loop for GEO, content and customer touchpoints.',
    inputLabel: '目标人群、产品事实、品牌规则',
    inputLabelEn: 'Audience, product facts and brand rules',
    outputLabel: '主题机会、内容任务、验证指标',
    outputLabelEn: 'Topic opportunities, content tasks and validation metrics',
    steps: ['定义受众、渠道与基线指标', '检索市场信号和产品证据', '形成主题矩阵与内容任务', '完成事实、品牌与版权审核', '发布后复测可见度与业务转化'],
    stepsEn: ['Define audience, channels and baseline metrics', 'Retrieve market signals and product evidence', 'Build a topic matrix and content tasks', 'Review facts, brand and copyright', 'Measure visibility and business outcomes after release'],
    checks: ['不虚构案例与排名', '市场数据标注来源', '增长结论保留对照基线'],
    checksEn: ['No fabricated cases or rankings', 'Source market claims', 'Keep a comparison baseline for growth claims'],
  },
  {
    id: 'knowledge',
    code: 'KNOWLEDGE-03',
    name: '知识智能体',
    nameEn: 'Knowledge agent',
    description: '从已发布资料中查找依据，整理成便于决策的研究简报。',
    descriptionEn: 'Retrieve and synthesize governed material into research briefs with explicit evidence boundaries.',
    inputLabel: '研究问题、资料范围、时间边界',
    inputLabelEn: 'Research question, corpus and time boundary',
    outputLabel: '证据清单、结论分层、待核验问题',
    outputLabelEn: 'Evidence list, layered conclusions and open questions',
    steps: ['界定问题、时间与可用资料', '区分官方来源、外部证据与内部判断', '按主题聚合一致与冲突观点', '输出结论、引用和不确定性', '由责任人确认后进入业务流程'],
    stepsEn: ['Define the question, timeframe and corpus', 'Separate official sources, external evidence and internal judgment', 'Group aligned and conflicting findings', 'Report conclusions, citations and uncertainty', 'Require accountable review before operational use'],
    checks: ['来源可追溯', '事实与建议分层', '未知项不补写'],
    checksEn: ['Traceable sources', 'Facts separated from recommendations', 'No invented answers for unknowns'],
  },
  {
    id: 'compute',
    code: 'COMPUTE-04',
    name: '算力运维智能体',
    nameEn: 'Compute operations agent',
    description: '根据服务速度、容量、质量和成本，整理算力运维建议。',
    descriptionEn: 'Use latency, throughput, quality and cost signals to support inference scheduling and incident handling.',
    inputLabel: '工作负载、服务目标、资源约束',
    inputLabelEn: 'Workload, service objectives and resource constraints',
    outputLabel: '路由建议、告警分级、处置步骤',
    outputLabelEn: 'Routing recommendations, incident levels and response steps',
    steps: ['读取工作负载与服务目标', '比较模型、容量、时延与单位成本', '给出路由、批处理与缓存建议', '异常进入降级、隔离或人工处置', '记录服务水平和容量复盘'],
    stepsEn: ['Read workload and service objectives', 'Compare models, capacity, latency and unit cost', 'Recommend routing, batching and caching', 'Route anomalies to degradation, isolation or human response', 'Record service levels and capacity findings'],
    checks: ['代表性负载先验证', '变更保留回滚路径', '资源承诺以合同为准'],
    checksEn: ['Validate with representative workloads', 'Keep a rollback path for changes', 'Resource commitments require a contract'],
  },
];

const clampText = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

export function buildAgentBrief({ agentId, goal, context = '', language = 'zh' }) {
  const template = agentTemplates.find((item) => item.id === agentId) || agentTemplates[0];
  const en = language === 'en';
  const safeGoal = clampText(goal, 300);
  const safeContext = clampText(context, 1000);
  return {
    mode: 'guided-workflow',
    generatedBy: en ? 'Local workflow template' : '本地工作流模板',
    storesInput: false,
    agentId: template.id,
    code: template.code,
    name: en ? template.nameEn : template.name,
    goal: safeGoal,
    context: safeContext,
    summary: en
      ? `${template.nameEn} has structured “${safeGoal}” into a five-stage workflow. Confirm data access, owners and acceptance evidence before execution.`
      : `${template.name}已将“${safeGoal}”整理为五阶段工作流。执行前请确认数据权限、责任人与验收证据。`,
    input: en ? template.inputLabelEn : template.inputLabel,
    output: en ? template.outputLabelEn : template.outputLabel,
    steps: en ? template.stepsEn : template.steps,
    checks: en ? template.checksEn : template.checks,
    humanGate: en
      ? 'External publishing, commitments, payments, permissions and consequential decisions require accountable human approval.'
      : '对外发布、承诺、支付、权限变更与高影响决策必须由责任人确认。',
    nextAction: en
      ? 'Select one representative task, record its current baseline, and run a controlled pilot with a rollback path.'
      : '选择 1 个代表性任务，记录当前基线，在保留回滚路径的前提下开展受控试点。',
    disclaimer: en
      ? 'This brief is produced by a deterministic workflow template. It is not a live model answer or a promise of implementation results.'
      : '本简报由确定性工作流模板生成，不是在线大模型回答，也不构成实施效果承诺。',
  };
}
