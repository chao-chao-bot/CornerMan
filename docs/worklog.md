# CornerMan 工作日志

记录每次大型修改。新记录追加在最上方（倒序）。
每条字段：日期 / 范围 / 改动摘要 / 影响文件 / 备注。

## 2026-06-10 · 时间轴拳型轨 + 证据 chip 即时刷新修复
- 范围：ai-service / video-worker / packages / web / 文档
- 改动摘要：
  - **逐拳事件输出**：[pose.py](apps/ai-service/app/pose.py) `VideoAnalysis` 增 `punch_events`(复用已检测的 `punches`)；[main.py](apps/ai-service/app/main.py) `AnalyzeResponse` 增 `punch_events:[{t_ms,kind,speed}]`
  - **落库**（复用 `Video.poseMetrics` JSON，无新迁移）：[shared-types](packages/shared-types/src/index.ts) 增 `PunchEventDTO` 与 `PoseMetrics.punchEvents`；[pose-client.ts](apps/video-worker/src/pose-client.ts) 过滤合法拳型后并入 `metrics.punchEvents`；[ai-prompts](packages/ai-prompts/src/index.ts) `renderPoseMetrics` 跳过 `punchEvents` 键（逐拳太细不喂 LLM，已有每片段拳型分布）
  - **时间轴第三轨「拳型」**：[videos-panel.tsx](apps/web/app/sessions/[id]/videos-panel.tsx) `SegControl` 增 `拳型 N` 选项；每拳渲染 3px 色条（直拳=蓝/勾摆=橙/上勾=红），hover 显示时间+拳型+腕速，点击 seek 到该拳前 0.5s；图例显示三拳型计数；无逐拳数据时空态提示
  - **修复证据 chip 需刷新才出现**：[report-panel.tsx](apps/web/app/sessions/[id]/report-panel.tsx) `loadSegments` 原仅挂载执行一次，新建训练进页面时视频未就绪 segMap 为空，草稿轮询出现后 chip 查不到片段时间而不渲染；新增 effect 在 `videosReady` 或报告草稿/定稿出现时重拉 segMap
- 影响文件：`apps/ai-service/app/{pose,main}.py`、`apps/video-worker/src/pose-client.ts`、`packages/{shared-types,ai-prompts}/src/index.ts`、`apps/web/app/sessions/[id]/{videos-panel,report-panel}.tsx`、`docs/worklog.md`
- 验证：93s 视频重跑——`poseMetrics.punchEvents` 落库 81 条（{straight:19, hook_swing:40, uppercut:22}，样例 `{tMs:7340,kind:straight,speed:5.34}`）；DeepSeek 报告 6 条；turbo typecheck 9/9 全绿
- 备注：逐拳事件只前端展示不进 prompt；拳型颜色复用 brand/revise/risk 三色与动作轨保持一致

## 2026-06-10 · 拳击动作体系升级：主标签 + 副标签 + 绝对阈值
- 范围：ai-service / video-worker / packages / web / 文档
- 改动摘要：
  - **pose.py 标签体系重构**：主标签互斥（punch_burst / **evade 躲闪**(新) / footwork / guard_hold / high_activity / **rest**(替代 low_activity)），副标签叠加在出拳串上（主要拳型 / **combo 组合拳**(连续≥3拳间隔<1s) / **moving 移动中出拳** / **with_evade 含躲闪**）
  - **躲闪检测**：头部(NOSE)相对肩线的快速横移（slip ≥1.2 肩宽/秒）或下潜回升（duck 深度≥0.5 肩宽），用相对坐标排除整体走动假阳性，出拳前后 400ms 头动排除；事件 500ms 去重、2s 聚类成 evade 片段
  - **阈值改绝对值**（肩宽归一化跨视频可比，替代"本视频分位数"自适应——后者在全程都在动的视频里永远不达标）：footwork ≥0.8、high_activity ≥1.5
  - **护手判定放宽**：从"双腕高于肩线"改为"至少一腕高于下巴线（鼻-肩中点）"，到位率从恒 0% 变为可测
  - 每片段指标增 `evadeCount`；summary 增全视频 `evade_count`；shared-types/pose-client/ai-prompts 同步（LABELS 白名单加 evade/rest，prompt 1.2.0→1.3.0 增躲闪/组合拳/移动中出拳标签翻译与指标渲染）
  - **web**：标签中文/色块增 躲闪(红)/休息(灰)/组合拳/移动中出拳/含躲闪；**证据轨只留复盘条目引用**（评分证据噪音大，从聚合与图例移除）；**报告页移除再次上传入口**（Uploader/useVideoUpload/上传进度卡片删除，视频只在新建训练时上传），空态文案改「视频在新建训练时一并上传」
- 影响文件：`apps/ai-service/app/{pose,main}.py`、`apps/video-worker/src/pose-client.ts`、`packages/{shared-types,ai-prompts}/src/index.ts`、`apps/web/app/{lib/labels.ts,sessions/[id]/{videos-panel,report-panel}.tsx}`、`docs/worklog.md`
- 验证：93s 视频重跑——15 片段全部带副标签（combo×10、moving×12、with_evade×13），开头空隙标 rest、83-87s 标 footwork（不再是"低强度"）；DeepSeek 报告 6 条引用具体片段（如「片段#9 直拳比例 4/5 可参考」「片段#7 躲闪9次但护手缺失」）；turbo typecheck 9/9 全绿
- 备注：躲闪检测在连续出拳视频里偏敏感（拳带动头动未被 400ms 窗口完全排除），with_evade 几乎全覆盖，后续可上调 EVADE_SLIP_SPEED_TH 或加长排除窗口；评分证据数据仍写库（Score.evidenceSegmentIds），只是不进前端证据轨

## 2026-06-10 · 细粒度切片 + 技术维度标签 + 双轨时间线 + 指标面板
- 范围：ai-service / api / video-worker / packages / web / 文档
- 改动摘要：
  - **ai-service · pose.py**：切片参数收紧（`BURST_GAP_MS` 2500→1200、`MAX_SEG_MS` 30000→10000）；超长出拳串在拳间隔最大处递归切开（替代固定步长硬切），重叠合并超上限时改在重叠中点切开以保住粒度；**拳型粗分类**（腕部轨迹：向上占比≥55%→上勾 / 径向伸展占比≥60%→直拳 / 其余→勾摆）；新增 `footwork`（踝部位移密度 p70 自适应）与 `guard_hold`（每秒护手到位≥70% 且无出拳）片段标签；`_enrich_segments` 按片段时间窗聚合每片段指标（punchCount/avgPunchSpeed/punchTypes/activity/footworkIntensity/guardUpRatio）；summary 增全视频 `punch_types`
  - **/analyze 响应**：`action_segments[]` 增 `tags[]`（label+主要拳型）与 `metrics`
  - **落库**：schema `Video.poseMetrics Json?` + `VideoSegment.metrics Json?`（migration `pose_metrics`）；worker `pose-client` 解析 tags/metrics，`process-video` 写入片段 metrics 与视频级 poseMetrics
  - **LLM**：prompt 1.1.0→1.2.0；每片段行渲染标签+指标（如「勾/摆拳串：出拳18次，护手12%」）；系统提示要求观察定位到具体片段并引用 id；`analyze.ts` 把片段 metrics 传入 input
  - **web · 双轨时间线**：`VideoStage` 加 SegControl 切换「动作片段 / 证据片段」两轨——动作轨按主标签着色（出拳串/步伐/防守/高低活动）+tooltip 显示指标；证据轨只显示被条目/评分引用的片段（条目蓝/评分绿），点击 seek 视频 + `onLocate` 反向定位右栏条目（滚动+闪烁高亮 2.2s，评分证据定位评分区）；`EvidenceRef{segmentId,kind,refKey,label}` 取代原 `evidenceIds` 通道
  - **web · 指标面板**：报告页新增「动作指标」Module（StatStrip：出拳次数/频率/护手到位率/高强度占比 + 拳型分布与检出率脚注），多视频聚合（次数求和、比率平均）；API `VideoDTO` 带出 `poseMetrics`、`VideoSegmentDTO` 带出 `metrics`
- 影响文件：`apps/ai-service/app/{pose,main}.py`、`apps/api/{prisma/**,src/videos/videos.service.ts}`、`apps/video-worker/src/{pose-client,process-video,analyze}.ts`、`packages/{shared-types,ai-prompts}/src/index.ts`、`apps/web/app/{lib/labels.ts,sessions/[id]/{page,videos-panel,report-panel,types}.tsx?}`
- 验证：24s 测试视频重新入队 → 3 个片段（`punch_burst+hook_swing` / `punch_burst+uppercut` / `punch_burst+hook_swing`），每片段含真实指标；DeepSeek 草稿 5 条，多条目分别引用不同片段并写明区间与指标依据（如「片段#1 0-8.9s 出拳19次无一护手」）；7 维评分均带证据片段；turbo typecheck 9/9 全绿
- 备注：拳型为单机位 2D 粗判（勾/摆合并一类）；该视频全程出拳故无 footwork/guard_hold 片段，待有间歇的视频自然出现；精确拳种与角度纠错留 P5

## 2026-06-10 · ai-service 真实姿态分析 + 动作驱动切片（P4 提前启动）
- 范围：ai-service / video-worker / packages / 文档
- 改动摘要：
  - **ai-service**：启用 `mediapipe/numpy/opencv-python-headless`（要求 Python 3.10–3.12）；新增 `app/pose.py`——OpenCV ~8fps 采样 + MediaPipe Pose（lite，CPU）逐帧关键点，腕速峰值（≥4 肩宽/秒，250ms 去重）→ 出拳候选 → 聚类成 `punch_burst` 片段（pad+最小/最大时长）；每秒运动密度（自适应阈值 p60）→ `high_activity/low_activity` 区间；护手到位率（双腕高于肩线占比）/ 站距/肩宽 等姿态统计 → summary。检出率 <20% 抛 `PoseNotDetected`
  - **/analyze 重写**：入参 `{session_id, video_url}`（签名 360p URL，下载后分析）；返回 `action_segments[] + summary + stub:false`；mediapipe 缺失/下载失败/检不到人 → 降级 `stub:true + reason`，不抛 500；`/health` 带 `pose_available`
  - **video-worker**：`storage.ts` 增 `presignGetUrl`（`@aws-sdk/s3-request-presigner`，新依赖）；新增 `pose-client.ts`（超时随时长伸缩 60s+0.5×duration 上限 10min，stub/空片段/异常一律返 null）；`process-video.ts` 切片前调 ai-service——成功用动作片段写 `VideoSegment`（真实 `tags`/`aiConfidence`），失败回退 `detectSceneCuts + buildCandidateSegments` 机械兜底；姿态 summary 经 `ai.analyze` job payload 透传
  - **analyze.ts**：删除旧 `fetchPoseMetrics`（只能拿 stub 元信息），改为复用 process 阶段透传的 `poseMetrics` 入参
  - **shared-types**：`PoseMetrics` 结构化（punchCount/punchesPerMin/guardUpRatio/stanceWidthRatio/highActivityRatio/detectRate 等，保留索引签名）；新增 `ActionSegmentLabel`
  - **ai-prompts**：prompt 版本 1.0.0→1.1.0；片段标签译成人话（出拳串/高低活动/候选）；姿态指标按中文标签+单位渲染，明示"以实测数据为依据"，无数据时要求降低置信度
- 影响文件：`apps/ai-service/{app/{main,pose,__init__}.py,requirements.txt,pyproject.toml,README.md}`、`apps/video-worker/src/{storage,pose-client,process-video,analyze,index}.ts`、`apps/video-worker/package.json`、`packages/{shared-types,ai-prompts}/src/index.ts`、`docs/{roadmap,worklog}.md`
- 验证：`tsc --noEmit`（video-worker/shared-types/ai-prompts）全绿；ai-service venv（uv + Python 3.11）安装依赖、起服务、端到端见下次记录/用户浏览器验证
- 备注：本机默认 Python 3.14 无 mediapipe wheel，README 注明用 `uv venv --python 3.11`；前端无需改动（时间线已按 tags/置信度渲染，自动受益）；存量视频不回刷，新上传生效

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
