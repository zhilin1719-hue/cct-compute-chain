# CCT 算链集团 · AI Industrial Network 官网与运营平台

可运行的中文／英文集团官网、AI 智能体、AI 智库、管理后台、后端 API 和持久数据库。产品叙事覆盖推理基础设施、企业智能体、私有 AI、行业系统、治理控制平面与算能协同；全球市场数据与 CCT 自身内容采用独立证据标签。

## 快速访问

- 官网：`http://127.0.0.1:4173`
- 管理后台：`http://127.0.0.1:4173/admin`
- 账号与初始密码：本机 `LOCAL-ACCESS.md`（私密文件，不提交、不公开）。

## GitHub Pages 永久公开链接

- 公开展示地址：https://zhilin1719-hue.github.io/cct-compute-chain/
- 源码仓库：https://github.com/zhilin1719-hue/cct-compute-chain
- 发布状态：https://github.com/zhilin1719-hue/cct-compute-chain/actions

该地址由 GitHub Pages 持续托管；可用性取决于仓库、账号和平台服务的持续维护。动态版输出到 `dist/`，Pages 版输出到 `dist-pages/`，两个构建相互独立。

仓库包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后，GitHub Actions 会运行后端测试、构建静态官网并发布 Pages。公开构建使用 Hash Router 和 `/cct-compute-chain/` 子路径，可直接刷新首页及所有前台路由。

GitHub Pages 只承载公开官网展示端，不运行 Node.js、SQLite、管理后台或咨询入库。公开版因此不显示可填写的咨询表单，也不采集联系信息。完整后台、API 和数据库继续由本项目的 Docker/Node 部署方式运行；启用正式咨询前需要确认正式域名、HTTPS、业务邮箱和受控服务端。

GitHub Pages 中的 AI 智能体使用浏览器内工作流模板，AI 智库使用浏览器内已发布内容检索，并明确标注本地模式。需要调用 DeepSeek 的版本部署在 Vercel Functions 或完整 Node 服务端，密钥仅配置为服务端环境变量；前端包、GitHub Pages 和 Git 历史均不得包含模型密钥。

## 启动

```sh
pnpm install --frozen-lockfile
pnpm setup
pnpm build
pnpm start
```

要求 Node.js 24+。`pnpm setup` 为新环境生成随机管理员密码；`.env` 存在时保留。数据库首次启动时初始化，后续重启持久保存内容、账号、线索与操作记录。

开发模式：分别执行 `pnpm dev:server` 和 `pnpm dev`。后端测试：`pnpm test`。完整服务端浏览器验收：`pnpm test:browser`。Pages 静态版验收：先执行 `pnpm build:pages`，再执行 `pnpm test:static`。全部检查：`pnpm verify`。备份：`pnpm backup`。

## 四层交付

| 层 | 实际实现 |
|---|---|
| 官网前端 | 首页、AI 智能体工作台、AI 智库、产品能力、行业方案、全球市场信号、八层架构、九大业务成熟度、交付闭环、生态、洞察、详情、咨询、隐私、条款、404；中英文切换和移动端 |
| 管理后台 | 登录、工作台、双语内容与智库来源编辑、CCT／市场／规划声明分层、证据等级与来源、未核验发布门禁、草稿／发布、线索跟进、设置、角色、审计、密码管理 |
| 后端 | Express API、DeepSeek 服务端代理、检索增强上下文、结构化输出校验、输入验证、角色权限、会话与 CSRF、同源校验、限流、静态页面托管 |
| 数据库 | SQLite 表结构与初始化，账号、会话、内容、线索、设置、审计六类实体，持久化与备份 |

技术依赖版本由 `pnpm-lock.yaml` 锁定。前端采用 React 19.3、Vite 8.3，后端采用 Node 24、Express 5.2、Zod 4。版本信息来自本次实际安装，而非仅依据方案描述。

## 细粒度文档

1. [产品与功能颗粒度](docs/01-产品与功能颗粒度.md)：页面、角色、字段、操作、反馈与范围。
2. [架构与数据设计](docs/02-架构与数据设计.md)：四层架构、数据实体、生命周期与安全边界。
3. [接口契约](docs/03-接口契约.md)：请求、响应、角色和校验。
4. [部署与运营手册](docs/04-部署与运营手册.md)：本机、Docker、上线资料、备份恢复与运营。
5. [验收记录](docs/05-验收记录.md)：实际运行检查、截图与已知限制。
6. [宣传册主张与证据台账](docs/07-claims-register.md)：可公开叙事、待核验硬指标、材料冲突与补证规则。
7. [全球 AI 商业信号](docs/08-global-ai-market-signals.md)：一手来源、产品优先级、商业模式与引用边界。
8. [AI 智能体与 AI 智库](docs/11-AI智能体与AI智库.md)：场景、交互、接口、DeepSeek 接入、检索增强、安全边界、降级与验收。

## 内容说明

站点文案基于 CCT 历史规划，为可编辑的首版草案。未提供的业绩、客户、融资或合作关系未写成事实。算力图是概念可视化，不表示实时 GPU 网络。完整服务端的咨询表单真实入库，后台可跟进；DeepSeek 仅生成任务简报或基于已发布资料做归纳，不执行支付、邮件发送、GPU 调度、链上交易、第三方 CRM 写入或其他外部动作。

本交付为独立本机系统和可部署源码；实际域名、企业主体资料、正式邮箱、服务器与 HTTPS 未配置之前，不代表已成为公开上线的集团官方网站。
