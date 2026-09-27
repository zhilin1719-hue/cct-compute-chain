# AI 智能体与 AI 智库

## 1. 产品目标与边界

本模块把 CCT 已有的“智能体系统”和“数据与知识平台”从能力说明变成两个可操作入口：

- `/agents`：用户选择场景、填写目标与背景，获得结构化执行简报。
- `/think-tank`：用户检索已发布知识，按证据范围筛选，并在服务端可用时调用 DeepSeek 做有来源的归纳。
- AI 不直接访问企业内部系统，不持有工具权限，也不执行对外发布、承诺、支付、权限变更或高影响决策。
- 用户输入不写入 CCT 的内容、线索或审计数据库。模型提供商的数据处理规则仍以双方账户和服务条款为准。

## 2. AI 智能体颗粒度

| 智能体 | 输入 | 工作流 | 输出 | 强制控制点 |
|---|---|---|---|---|
| 运营智能体 | 流程、知识、服务规则 | 意图识别→检索→草案→人工确认→记录 | 任务队列、回复草案、接管点 | 来源复核、承诺审批、数据最小化 |
| 增长智能体 | 受众、产品事实、品牌规则 | 基线→研究→主题矩阵→审核→复测 | 内容任务、渠道计划、验证指标 | 不虚构排名、来源标注、对照基线 |
| 知识智能体 | 研究问题、资料范围、时间边界 | 定义问题→证据分层→观点聚合→引用输出→责任人确认 | 证据清单、结论分层、待核验问题 | 来源可追溯、事实建议分层、未知不补写 |
| 算力运维智能体 | 工作负载、服务目标、资源约束 | 读取目标→比较方案→路由建议→异常处置→容量复盘 | 路由建议、告警等级、处置步骤 | 代表负载验证、回滚、合同边界 |

每份简报包含 `summary`、`input`、`output`、`steps`、`checks`、`humanGate`、`nextAction`。页面显示生成方式；在线模型不可用时自动回退到确定性模板，并显示降级提示。

## 3. AI 智库颗粒度

智库不创建另一套内容数据库。它复用后台已经发布的 `service`、`solution`、`insight` 内容，并保留以下字段：

- `claimScope=market`：外部市场事实，发布时必须有官方一手来源、HTTPS 链接和日期。
- `claimScope=cct`：CCT 能力、方法或观点。
- `claimScope=proposal`：规划方向，不表示已建成或已交付。
- `evidenceLevel`：内部材料、官方一手来源、外部二手来源或未核验。

检索先按问题词与证据范围排序，最多向模型提供 6 条记录；每条记录只传标题、摘要、有限正文摘录、声明范围和来源。模型必须使用 `[K1]`、`[K2]` 引用记录，前端同时展示原内容页面与原始来源链接。AI 归纳不会修改内容的证据等级。

## 4. DeepSeek 服务端接入

环境变量：

```text
DEEPSEEK_API_KEY=<server-only secret>
DEEPSEEK_MODEL=deepseek-flash
```

当前实现调用 `https://api.deepseek.com/chat/completions`，使用非思考模式与 JSON Output。输出在返回浏览器前经过 Zod 校验和长度、数组数量约束。官方接口参考：

- https://api-docs.deepseek.com/api/create-chat-completion/
- https://api-docs.deepseek.com/guides/json_mode/

密钥不得放入 `VITE_` 环境变量、React 代码、HTML、浏览器存储、GitHub Pages、日志、截图或 Git 历史。`.env` 已被 Git 忽略；Vercel 使用加密环境变量。

## 5. 接口契约

### `POST /api/public/ai/agent`

请求：

```json
{
  "agentId": "operations | growth | knowledge | compute",
  "goal": "5-300 characters",
  "context": "0-1000 characters",
  "language": "zh | en"
}
```

响应的 `brief.mode` 为：

- `deepseek-live`：DeepSeek 返回并通过结构校验。
- `guided-workflow`：未配置模型或上游失败，使用本地模板。

### `POST /api/public/ai/ask`

请求：

```json
{
  "question": "5-500 characters",
  "scope": "all | market | cct | proposal",
  "language": "zh | en"
}
```

响应的 `result.mode` 为：

- `deepseek-grounded`：基于检索记录完成在线归纳。
- `knowledge-search`：只返回匹配资料，不伪装为模型回答。

## 6. 安全与费用控制

- 浏览器只能访问本站代理，无法读取 DeepSeek 密钥。
- 写请求校验同源、`application/json`、字段长度与枚举值。
- Express 和 Vercel Function 均限制同一 IP 的调用频率；Vercel 内存限流是实例级基础保护，生产规模应再启用平台防火墙或持久化速率限制。
- 上游请求 25 秒超时，限制输出 token，并缩短智库上下文。
- 不记录用户问题、业务背景、上游原始响应或密钥。
- 上游报错不向浏览器返回账户、供应商或内部异常详情。
- 所有外部写入、高影响决策和正式承诺必须经过人工确认。

## 7. 三种运行模式

| 模式 | 内容来源 | AI 行为 | 管理后台／咨询 |
|---|---|---|---|
| 完整 Node 服务 | SQLite 已发布内容 | 服务端 DeepSeek；无密钥则降级 | 可用 |
| Vercel AI 服务版 | 构建时公开内容 | Vercel Function 调用 DeepSeek | 不开放 |
| GitHub Pages | 构建时公开内容 | 浏览器内模板与本地检索 | 不开放 |

## 8. 验收清单

- 四种智能体均可选择，选中状态与键盘焦点可见。
- 目标少于 5 个字符时不发送请求。
- 简报显示生成方式、步骤、控制点、人工决策门与免责声明。
- 智库可按全部／市场／CCT／规划筛选并清空检索。
- 在线归纳保留来源列表；静态版明确显示本地检索。
- 390px 与 1440px 页面无横向溢出。
- 中英文页面、移动导航、全局搜索和 404 不受影响。
- 后台可按证据范围筛选，市场信号仍受官方来源发布门禁约束。
- 构建产物与 Git 受控文件不包含任何 API 密钥。
