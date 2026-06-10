# CornerMan 工作日志

记录每次大型修改。新记录追加在最上方（倒序）。
每条字段：日期 / 范围 / 改动摘要 / 影响文件 / 备注。

## 2026-06-10 · 训练记录:列表表格 + 新建上传合一 + 删除（Coach Lab 对齐）
- 范围：api / packages / web / 文档
- 改动摘要：
  - **schema**：`TrainingSession` 增 `durationMin`/`location`/`focus`;migration `session_meta_fields`（沿用 `migrate deploy` 落库 + `prisma generate`）
  - **api · training-sessions**：`create` 写入新字段;新增 `DELETE /training-sessions/:id` 软删除（置 `deletedAt` + 归属校验）;`findAllByUser` 改为聚合返回 `SessionListItemDTO[]`——含 `reportStatus`(final/draft/pending,取自 `AnalysisReport.status`)与 `overallScore`/`aiScore`(取自 `Score(overall)`,user 分优先)
  - **shared-types**：`CreateTrainingSessionInput`/`TrainingSessionDTO` 加 `durationMin?/location?/focus?`;新增 `SessionReportStatus` 与 `SessionListItemDTO`
  - **api-client**：`listSessions` 返回 `SessionListItemDTO[]`;新增 `deleteSession`
  - **ui**：新增 `Table`(arbitrary-variant 样式 th/td)、`SegControl`(分段筛选)、`StatStrip`/`StatBox`(统计条)
  - **web · lib**：抽 `upload-video.ts`(`putWithProgress` + `uploadVideoFile` 单文件 init→PUT→complete);`useVideoUpload` 改为复用之
  - **web · 新建页**：两栏「训练信息(类型 SegControl/日期 DatePicker/时长/地点/本次重点/感受,标题可选自动兜底) + 训练视频」;文件先暂存内存(待上传卡片可移除),顶栏「取消 / 保存并开始分析」(经 AppFrame `headerExtras`);保存=建 session→逐个上传(进度条)→跳 `/sessions/[id]`,取消不留数据
  - **web · 列表页**：页头 + SegControl 类型筛选 + StatStrip(累计训练/时长/最近综合分/连续周数,客户端聚合) + Table(训练/类型/时长/综合分/状态/日期/删除),整行点击进报告,行内删除带确认且 stopPropagation
- 影响文件：`apps/api/prisma/**`、`apps/api/src/training-sessions/**`、`packages/{shared-types,api-client,ui}/**`、`apps/web/app/{lib/{upload-video,use-video-upload}.ts,sessions/{page,new/page}.tsx}`、`docs/worklog.md`
- 验证：`migrate deploy` 落库成功;`tsc --noEmit` 全 8 包绿(api/web/ui/api-client/shared-types);交回用户浏览器验证 列表表格/筛选/删除、新建选文件→保存并开始分析→跳报告页轮询、取消无残留
- 备注：「连续周数」按 session 日期客户端粗算,未加后端聚合;新建页"标题"留空时回退 本次重点 或 类型+日期

## 2026-06-10 · P3 报告页内嵌播放 + 证据驱动时间线联动
- 范围：web（前端三个文件，未动后端）
- 改动摘要：
  - **内嵌播放**：`VideoStage` 用原生 `<video controls playsInline poster src=签名URL>` 原地播放，替换原 `target=_blank` 外链；装饰播放按钮 `pointer-events-none` 且播放后隐藏
  - **时间线联动播放**：state 跟踪 `current/dur`，轨道点击按比例 seek、候选片段按钮点击跳转并高亮当前片段、同步播放头与「当前/总时长」时间轴
  - **报告↔视频联动**：`page.tsx` 提升 `seek({videoId,ms,nonce})` 与 `evidenceIds` 状态，`requestSeek` 透传给 `VideosPanel`/`ReportPanel`
  - **证据可点击跳转**：`report-panel` 的 `segMap` 补 `videoId`，「证据片段」chip 改为按钮，点击 `onSeek` → 对应视频平滑滚入视野并跳转播放
  - **证据驱动高亮**：报告条目 `segmentId` ∪ 评分 `evidenceSegmentIds` 汇总上抛；时间线对被 AI 引用的片段实色高亮、其余 `bg-brand/25` 淡化，图例切换为「AI 引用片段 / 其他候选」
- 影响文件：`apps/web/app/sessions/[id]/{page,report-panel,videos-panel}.tsx`
- 验证：`pnpm --filter @cornerman/web typecheck` 通过、无 lint 报错；交回用户浏览器验证
- 备注：真实「关键片段识别」（出拳/防守/失衡等动作定位）依赖真实姿态/动作分析，`ai-service` 当前仍为 stub（属 P4）；故现阶段时间线只在「有 AI 证据引用」时才有真正展示价值，无证据时退化为均匀候选片段（仅供 seek）

## 2026-06-09 · P3 AI 复盘闭环（DeepSeek/stub → draft，逐条定稿 + 改分）
- 范围：api / video-worker / packages / web / 文档
- 改动摘要：
  - **schema**：`AnalysisReport` 增 `promptVersion`；`Score` 增 `rationale`/`evidenceSegmentIds` 及 `@@unique([sessionId,dimension])`（供改分 upsert）；migration `ai_report_fields`（因 CLI 非交互，经 `migrate diff` 生成 SQL + `migrate deploy` 落库）
  - **shared-types**：新增 `ReportDTO`/`ScoreDTO`/`RevisionDTO`/`SessionReportDTO`、`CreateRevisionInput`/`UpdateScoreInput`、LLM IO `ReportDraftInput`/`ReportDraftOutput`
  - **ai-prompts**：实装报告起草 prompt（system + 严格 JSON 约束 + 7 维评分 + 证据片段引用）、`renderReportDraftPrompt`、`REPORT_PROMPT_VERSION`；改为 build 到 dist 供 worker 消费
  - **video-worker**：`LLMProvider` 抽象 + `DeepSeekProvider`（全局 fetch 调 OpenAI 兼容 `/chat/completions`，`response_format=json_object`，解析校验维度/片段引用）+ 确定性 `StubProvider` + 工厂；新增第二个 `ai.analyze` Worker，消费后可选调 ai-service 取姿态 stub→组装输入→DeepSeek 失败兜底回退 stub→事务写 `AnalysisReport(draft)`+`Score(ai)`；按 session 幂等（已有 draft 跳过）
  - **api · reports**：`GET /training-sessions/:id/report`（draft+final+scores+revisions 聚合）、`POST .../report/finalize`（无 final 则克隆 draft 懒定稿）
  - **api · revisions**：`POST /reports/:id/revisions`，accept/edit/delete/add 四类操作，自动先 finalize，每次把 draft 同 key 原文快照写入 `aiOriginal`，新增条目 key=`user-<uuid>`
  - **api · scoring**：`PATCH /training-sessions/:id/scores/:dimension` upsert `userScore`
  - **api-client**：`getSessionReport`/`finalizeReport`/`createRevision`/`updateScore`
  - **web**：训练详情页 `ReportPanel`（draft/final 标识、summary、条目卡含维度标签/证据时间 chip/置信度、采纳/修改/删除、新增我的条目、AI 原文保留、7 维滑块改分乐观更新、video ready 后 3s 轮询 draft）；`VideosPanel` 增 `onReadyChange` 回调
- 影响文件：`apps/api/prisma/**`、`apps/api/src/{reports,revisions,scoring,app.module}.ts/**`、`apps/video-worker/src/{analyze,index}.ts`、`apps/video-worker/src/llm/**`、`apps/video-worker/.env`、`packages/{shared-types,ai-prompts,api-client}/**`、`apps/web/app/{lib/labels.ts,sessions/[id]/{page,report-panel,videos-panel}.tsx}`、`docs/roadmap.md`
- 验证：curl 全链路（注册→建 session→上传小视频→ready→轮询见 draft（summary+5 条+7 维评分，含 modelVersion/promptVersion）→finalize→edit(aiOriginal 保留)/add(6 条)/delete(5 条)→改分 defense userScore=7.5 与 aiScore=8.1 并存→draft 始终不可变）通过；DeepSeek 调用接通并自动降级（所提供 key 直连验证为 401 失效，已走 stub 兜底）；web 报告页登录后渲染 summary/条目/滑块且修改表单可用；`tsc --noEmit` 全 8 包绿
- 备注：worker 新增依赖 `@cornerman/ai-prompts`；DeepSeek 为默认 provider，更换有效 key（写入 gitignored `apps/video-worker/.env`）即由真实模型生成；真实姿态测量（ai-service VL）、证据片段跳转播放、ProblemThread 串联留待 P4+

## 2026-06-09 · P2 视频上传 + 处理（直传 + 转码流水线）
- 范围：api / video-worker / packages / web / infra / 文档
- 改动摘要：
  - **schema**：`Video` 增 `originalFileName/contentType/sizeBytes/playback720Key/playback360Key/framesPrefix/errorMessage`；migration `video_processing_fields`
  - **shared-types**：新增 `InitVideoUploadInput/Response`、`CompleteVideoUploadInput`、`VideoDTO`、`VideoSegmentDTO`
  - **api · storage**：`StorageService` 抽象 + `MinioStorageService`（AWS SDK v3，S3 兼容预签名 PUT/GET，启动 `ensureBucket`），全局 `StorageModule`；生产预留阿里云 OSS
  - **api · queue**：轻量 `VideoQueueService`（bullmq Queue，队列 `video.process`，jobId=videoId + 3 次重试），全局 `QueueModule`
  - **api · videos**：`upload-init`（建 Video=uploading + 预签名）、`upload-complete`（uploading→uploaded + 入队）、列表、详情（ready 时签名 poster/playback URL）；JWT + session 归属校验
  - **video-worker**：拆分 `storage/ffmpeg/segments/process-video/index`；下载原片→ffprobe→转码 720p/360p→首帧封面→每秒抽帧→上传产物→场景切点粗切片写 `VideoSegment`→ready→入队 `ai.analyze`；失败写 `failed`+errorMessage
  - **api-client**：`initVideoUpload/completeVideoUpload/listSessionVideos/getVideo`
  - **ui**：`Uploader`（拖拽 + H5 capture）
  - **web**：`useVideoUpload`（XHR 预签名 PUT 进度 + 顺序上传）、训练详情页 `VideosPanel`（上传区 + 进度 + 视频卡状态徽章/封面/片段数 + 3s 轮询直至稳定）
  - **infra**：MinIO 容器加 `MINIO_API_CORS_ALLOW_ORIGIN` 放行 `localhost:3000` 浏览器直传
- 影响文件：`apps/api/prisma/**`、`apps/api/src/{storage,queue,videos,app.module}.ts/**`、`apps/video-worker/src/**`、`apps/video-worker/.env`、`packages/{shared-types,api-client,ui}/**`、`apps/web/app/{lib,sessions/[id]}/**`、`infra/docker-compose.yml`、`docs/roadmap.md`
- 验证：curl 全链路 init→PUT(200)→complete→轮询 ready（durationMs/宽高写入、2 候选片段、poster+720p 签名 URL）；poster GET 200 image/jpeg；MinIO CORS 预检 204 + PUT 200（Origin=localhost:3000）；`ai.analyze` 已入队；web 登录/建训练/详情页渲染上传区通过（浏览器自动化无法触发系统文件选择器，故 PUT 用同源 CORS 模拟验证）；`tsc --noEmit` 全绿
- 备注：新增依赖 `@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`（api）、`@aws-sdk/client-s3`/`@prisma/client`/`dotenv`（worker）；需本机 `ffmpeg`；断点续传/tus、阿里云 STS 实装留待接 OSS 时

## 2026-06-09 · P1 账号 + 训练记录纵切（首条端到端链路）
- 范围：api / packages / web / infra / 文档
- 改动摘要：
  - **api**：新增全局 `PrismaModule`/`PrismaService`；执行 `prisma migrate dev --name init` 落表（`User`/`TrainingSession`）
  - **api · auth**：`UsersService`（bcrypt）、`AuthService`（register/login/refresh/me，access 15min + refresh 30d）、自定义 `JwtAuthGuard` + `@CurrentUser` 装饰器、`RegisterDto`/`LoginDto`/`RefreshDto`
  - **api · training-sessions**：`create`/`list`/`detail`，受 `JwtAuthGuard` 守卫，userId 取自 token；`main.ts` 启用 CORS
  - **packages/shared-types**：补 auth/training DTO 与响应类型；改为构建到 `dist`（导出 `.d.ts`），api/api-client 经 `dist` 解析以绕过跨包 rootDir 限制
  - **packages/api-client**：实现 fetch 封装（自动 `Authorization: Bearer` + 结构化 `ApiError`），覆盖 auth 与 sessions
  - **packages/ui**：迁移 Coach Lab 基础组件 `Button/Input/Textarea/Field/Card/Tabs/AppShell` + `cn`/`navItemClass`
  - **web**：鉴权 store（localStorage）+ api 实例、登录/注册页、训练列表/新建/详情页、客户端路由守卫 `AppFrame`；`trends`/`problems` 占位页接入框架
  - **infra**：本机 5432 被既有 `postgresql@14` 占用，容器 Postgres 宿主机端口改 **5433**（`docker-compose.yml` + `.env`/`.env.example`）
- 影响文件：`apps/api/src/{prisma,users,auth,training-sessions}/**`、`apps/api/src/{main,app.module}.ts`、`apps/api/.env`、`packages/{shared-types,api-client,ui}/**`、`apps/web/app/**`、`apps/web/.env.local`、`.env`、`infra/docker-compose.yml`、`infra/.env.example`、`docs/roadmap.md`
- 验证：curl 跑通 register→me→创建/列出 session、未授权返 401；浏览器冒烟（注册→新建训练→列表可见）通过；`tsc --noEmit` 全绿（api/web/ui/api-client/shared-types）
- 备注：refresh 仅基础实现（暂无黑名单/轮换）；未做视频/AI/片段/趋势（P2+）

## 2026-06-09 · 新增执行路线图
- 范围：项目文档
- 改动摘要：
  - 新增 `docs/roadmap.md`：P0-P5 分阶段纵切交付，每阶段含任务清单与退出标准；附设计原则、横切关注点、依赖关系 mermaid 图、风险登记、上线准入清单
  - `README.md` 文档索引新增"执行路线图"一行
- 影响文件：`docs/roadmap.md`、`README.md`
- 备注：仅文档，未写业务代码；当前进度 P0 完成、P1 待启动

## 2026-06-08 · 本地容器 runtime 由 Docker 切换为 Podman
- 范围：本地开发环境 + infra 文档
- 改动摘要：
  - 本地容器 runtime 改用 Podman + podman-compose（开源，免 Docker Desktop）；compose 服务定义不变
  - 根 `package.json` 新增 `infra:up` / `infra:down` / `infra:logs` 脚本（封装 podman-compose）
  - 更新文档：`infra/docker-compose.yml` 头注释、`README.md` 本地启动步骤（补 podman machine 前置）、`docs/tech-design.md` 技术栈表新增"本地容器 runtime"行
- 影响文件：`package.json`、`infra/docker-compose.yml`、`README.md`、`docs/tech-design.md`
- 验证：`pnpm infra:up` 拉起 postgres/redis/minio 成功；redis `PONG`、postgres accepting connections；video-worker 打印 `[video-worker] ready`
- 备注：生产部署仍沿用阿里云 ECS + Docker，compose 文件两端通用

## 2026-06-08 · 搭建 monorepo 骨架
- 范围：全仓初始化
- 改动摘要：
  - 新增根 workspace 配置：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.gitignore`、`.npmrc`、`.nvmrc`
  - 新增 4 个 apps：`web`（Next.js 14）、`api`（NestJS，含 10 个模块空壳 + prisma schema 草稿）、`video-worker`（BullMQ）、`ai-service`（FastAPI，/health + /analyze stub）
  - 新增 5 个 packages：`config`、`shared-types`、`ui`、`api-client`、`ai-prompts`
  - 新增 `infra`：`docker-compose.yml`（Postgres/Redis/MinIO）、`.env.example`、`deploy/.gitkeep`
  - 更新根 `README.md`：工程结构图 + 本地启动说明
- 影响文件：`apps/**`、`packages/**`、`infra/**`、根配置文件、`README.md`
- 备注：仅骨架占位，未执行 `pnpm install` / `pip install`，未写业务逻辑
