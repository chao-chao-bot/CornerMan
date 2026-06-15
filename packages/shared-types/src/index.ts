/**
 * @cornerman/shared-types
 *
 * 跨前后端共享的核心实体类型骨架。
 * 与 docs/tech-design.md 第 10 节数据模型对齐；当前为占位级定义，字段后续随 Prisma schema 收敛。
 */

// ---------------------------------------------------------------------------
// 通用
// ---------------------------------------------------------------------------

export type ID = string;
export type ISODateString = string;

/** 所有持久化实体共享的基础字段（含软删除） */
export interface BaseEntity {
  id: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt?: ISODateString | null;
}

// ---------------------------------------------------------------------------
// 用户与鉴权
// ---------------------------------------------------------------------------

export interface User extends BaseEntity {
  email: string;
  username: string;
  displayName?: string;
  /** bcrypt 哈希，仅后端可见，前端 DTO 会剔除 */
  passwordHash?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** 对外可见的用户视图（剔除 passwordHash 等敏感字段） */
export interface PublicUser {
  id: ID;
  email: string;
  username: string;
  displayName?: string;
  createdAt: ISODateString;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  /** 邮箱或用户名 */
  identifier: string;
  password: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

// ---------------------------------------------------------------------------
// 模板（场景化训练记录）
// ---------------------------------------------------------------------------

/** 模板适用场景 */
export type TemplateScene =
  | "private_lesson"
  | "sparring"
  | "self_training"
  | "custom";

/** 模板 block 类型 */
export type TemplateBlockType =
  | "rich_text"
  | "short_text"
  | "rating"
  | "checklist"
  | "media_reference";

/** 模板 block 定义 */
export interface TemplateBlock {
  id: string;
  type: TemplateBlockType;
  title: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
}

/** 模板结构（JSON 描述，前端 Renderer 据此动态渲染编辑区） */
export interface TemplateSchema {
  version: number;
  blocks: TemplateBlock[];
}

/** 模板对外视图 */
export interface TemplateDTO {
  id: ID;
  /** 系统模板为空，个人模板为归属用户 id */
  userId?: ID;
  name: string;
  scene: TemplateScene;
  description?: string;
  schema: TemplateSchema;
  isSystem: boolean;
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** 创建自定义模板入参 */
export interface CreateTemplateInput {
  name: string;
  scene: TemplateScene;
  description?: string;
  schema: TemplateSchema;
}

/** 更新自定义模板入参 */
export interface UpdateTemplateInput {
  name?: string;
  scene?: TemplateScene;
  description?: string;
  schema?: TemplateSchema;
}

// ---------------------------------------------------------------------------
// 训练与视频
// ---------------------------------------------------------------------------

export type TrainingType = "private_lesson" | "self_training" | "sparring";

/** 单个 block 的填写内容（按 block id 存储） */
export interface SessionContentBlock {
  type: TemplateBlockType;
  /** 富文本结构化 doc（rich_text） */
  doc?: unknown;
  /** 富文本纯文本镜像，便于搜索 / 摘要 */
  plainText?: string;
  /** 非富文本 block 的值（short_text / rating / checklist 等） */
  value?: unknown;
}

/** 一次训练复盘的全部 block 内容 */
export type SessionContent = Record<string, SessionContentBlock>;

/** 实战结果 */
export type SessionOutcomeResult = "win" | "loss" | "draw" | "unscored";

/** 实战 / 约练成败结构（默认 unscored） */
export interface SessionOutcome {
  result: SessionOutcomeResult;
  opponent?: string;
  rounds?: number;
  note?: string;
  linkedProblemCodes?: string[];
}

export interface TrainingSession extends BaseEntity {
  userId: ID;
  title: string;
  trainingType: TrainingType;
  trainedAt: ISODateString;
  /** 训练者自填感受 / 备注 */
  userNote?: string;
  videoIds: ID[];
}

/** 创建训练的入参 */
export interface CreateTrainingSessionInput {
  title: string;
  trainingType: TrainingType;
  trainedAt: ISODateString;
  /** 时长（分钟） */
  durationMin?: number;
  /** 训练地点 */
  location?: string;
  /** 本次重点 */
  focus?: string;
  userNote?: string;
  /** 基于该模板创建，写入模板快照与空内容骨架 */
  templateId?: ID;
}

/** 保存复盘内容入参 */
export interface UpdateSessionContentInput {
  content: SessionContent;
}

/** 更新训练基础信息 / 实战成败入参（全部可选，仅更新传入字段） */
export interface UpdateSessionMetaInput {
  title?: string;
  trainingType?: TrainingType;
  trainedAt?: ISODateString;
  durationMin?: number;
  location?: string;
  focus?: string;
  userNote?: string;
  outcome?: SessionOutcome;
}

/** 训练记录对外视图（列表/详情返回） */
export interface TrainingSessionDTO {
  id: ID;
  title: string;
  trainingType: TrainingType;
  trainedAt: ISODateString;
  durationMin?: number;
  location?: string;
  focus?: string;
  userNote?: string;
  /** 创建时选择的模板 id */
  templateId?: ID;
  /** 创建时的模板结构快照，避免模板后续修改影响旧记录 */
  templateSnapshot?: TemplateSchema;
  /** 用户填写的 block 内容 */
  content?: SessionContent;
  /** 实战 / 约练成败 */
  outcome?: SessionOutcome;
  /** 最近一次用户保存内容的时间 */
  savedAt?: ISODateString;
  /** 复盘归档时间；有值表示用户已点「完成复盘」 */
  reviewedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * 列表页报告状态：
 * - pending：尚无 AI 报告（视频处理中/分析中）
 * - draft：已有 AI 草稿、用户尚未完成复盘（待复盘）
 * - final：用户已点「完成复盘」归档（reviewedAt 有值）
 */
export type SessionReportStatus = "pending" | "draft" | "final";

/** 训练列表项视图（含报告状态与综合分聚合） */
export interface SessionListItemDTO extends TrainingSessionDTO {
  reportStatus: SessionReportStatus;
  /** 综合分（用户分优先，否则 AI 分） */
  overallScore?: number;
  /** AI 综合分（用于副值展示） */
  aiScore?: number;
}

export type VideoStatus =
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export interface VideoAsset extends BaseEntity {
  sessionId: ID;
  status: VideoStatus;
  /** OSS 私有对象 key，对外通过签名 URL 访问 */
  objectKey: string;
  durationMs?: number;
  width?: number;
  height?: number;
  posterObjectKey?: string;
}

export interface VideoSegment extends BaseEntity {
  videoId: ID;
  startMs: number;
  endMs: number;
  tags: string[];
  /** 关联的问题码，串联 ProblemThread */
  problemCodes: string[];
  userNote?: string;
  /** AI 置信度 0~1 */
  aiConfidence?: number;
}

// ---------------------------------------------------------------------------
// 视频上传 / 处理（P2）
// ---------------------------------------------------------------------------

/** 发起上传：客户端声明文件元数据，换取直传凭证 */
export interface InitVideoUploadInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface InitVideoUploadResponse {
  videoId: ID;
  objectKey: string;
  /** 预签名 PUT 直传地址（浏览器直接 PUT 文件体） */
  uploadUrl: string;
  /** 上传时必须带上的请求头（如 Content-Type） */
  uploadHeaders: Record<string, string>;
  /** 凭证有效期（秒） */
  expiresIn: number;
}

/** 直传完成回调：触发后台处理 */
export interface CompleteVideoUploadInput {
  videoId: ID;
}

export interface VideoSegmentDTO {
  id: ID;
  videoId: ID;
  startMs: number;
  endMs: number;
  tags: string[];
  aiConfidence?: number;
  /** 片段级量化指标（姿态分析产出，可缺省） */
  metrics?: SegmentMetrics;
}

/** 视频对外视图：私有对象通过签名 URL 暴露（仅在 ready 时返回） */
export interface VideoDTO {
  id: ID;
  sessionId: ID;
  status: VideoStatus;
  originalFileName?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  errorMessage?: string;
  /** 封面签名 URL（ready 时） */
  posterUrl?: string;
  /** 720p 播放签名 URL（ready 时） */
  playbackUrl?: string;
  segmentCount: number;
  segments?: VideoSegmentDTO[];
  /** 姿态分析全局指标（ready 且分析成功时返回） */
  poseMetrics?: PoseMetrics;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// 分析报告（AI 起草 + 用户定稿）
// ---------------------------------------------------------------------------

export type ReportStatus = "draft" | "final";

export interface AnalysisReportItem {
  /** 条目稳定标识，供修订 diff 引用 */
  key: string;
  dimension: ScoreDimension;
  title: string;
  detail: string;
  problemCode?: string;
  segmentId?: ID;
  aiConfidence?: number;
}

export interface AnalysisReport extends BaseEntity {
  sessionId: ID;
  /** draft = AI 原始只读快照；final = 用户可编辑版本 */
  status: ReportStatus;
  summary: string;
  items: AnalysisReportItem[];
  /** 由哪个 LLM/模型版本生成 */
  modelVersion?: string;
}

export type RevisionAction = "accept" | "edit" | "delete" | "add";

/** 用户对 final 报告每个条目的逐条修订记录，永不覆盖 AI 原文 */
export interface ReportRevision extends BaseEntity {
  reportId: ID;
  itemKey: string;
  action: RevisionAction;
  /** AI 原文快照 */
  aiOriginal?: string;
  /** 用户修订结果 */
  userResult?: string;
}

// ---------------------------------------------------------------------------
// 问题追踪（跨训练串联）
// ---------------------------------------------------------------------------

export type ProblemStatus = "open" | "improving" | "improved" | "recurred";

export interface ProblemThread extends BaseEntity {
  userId: ID;
  problemCode: string;
  title: string;
  status: ProblemStatus;
  /** 出现次数 */
  occurrences: number;
  lastSeenAt: ISODateString;
  /** 改进证据（片段 / 报告条目引用） */
  improvedEvidence?: string;
  relatedReportItemKeys: string[];
  relatedSegmentIds: ID[];
}

// ---------------------------------------------------------------------------
// 评分
// ---------------------------------------------------------------------------

export type ScoreDimension =
  | "stance"
  | "guard"
  | "footwork"
  | "punch_technique"
  | "defense"
  | "combination"
  | "overall";

export interface Score extends BaseEntity {
  sessionId: ID;
  dimension: ScoreDimension;
  aiScore?: number;
  userScore?: number;
  /** AI 评分置信度 0~1 */
  confidence?: number;
}

// ---------------------------------------------------------------------------
// AI 复盘闭环 DTO（P3）
// ---------------------------------------------------------------------------

/** 报告对外视图（draft 或 final） */
export interface ReportDTO {
  id: ID;
  sessionId: ID;
  status: ReportStatus;
  summary: string;
  items: AnalysisReportItem[];
  modelVersion?: string;
  promptVersion?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** 评分对外视图（含可解释字段） */
export interface ScoreDTO {
  dimension: ScoreDimension;
  aiScore?: number;
  userScore?: number;
  confidence?: number;
  rationale?: string;
  evidenceSegmentIds: ID[];
}

/** 修订记录对外视图 */
export interface RevisionDTO {
  id: ID;
  reportId: ID;
  itemKey: string;
  action: RevisionAction;
  aiOriginal?: string;
  userResult?: string;
  createdAt: ISODateString;
}

/**
 * 报告覆盖范围：报告是 session 级聚合产物，可能存在「视频已 ready 但未纳入当前报告」
 * 的情况（典型为补传视频）。前端据此提示「重新生成完整复盘」。
 */
export interface ReportCoverage {
  /** 已就绪（可纳入分析）的视频数 */
  readyVideoCount: number;
  /** 当前 active 报告已纳入的视频数（其片段被报告条目/评分证据引用，或早于报告生成已 ready） */
  includedVideoCount: number;
  /** 已就绪但未纳入当前报告的视频 id（补传后尚未重新生成） */
  unincludedVideoIds: ID[];
  /** 当前 active 报告的更新时间（无报告时为 null） */
  reportUpdatedAt: ISODateString | null;
  /**
   * 报告引用了已不存在的片段（视频被重新处理后片段 id 变化导致悬空），
   * 证据片段将无法跳转，需要重新生成完整复盘。
   */
  staleEvidence: boolean;
}

/** 训练 session 的报告聚合响应 */
export interface SessionReportDTO {
  draft: ReportDTO | null;
  final: ReportDTO | null;
  scores: ScoreDTO[];
  revisions: RevisionDTO[];
  /** 报告覆盖范围（多视频/补传场景的纳入状态） */
  coverage: ReportCoverage;
}

/** 逐条修订入参 */
export interface CreateRevisionInput {
  itemKey: string;
  action: RevisionAction;
  title?: string;
  detail?: string;
  dimension?: ScoreDimension;
  problemCode?: string;
  segmentId?: ID;
}

/** 改分入参 */
export interface UpdateScoreInput {
  userScore: number;
}

// ---------------------------------------------------------------------------
// LLM 起草输入 / 输出（P3）
// ---------------------------------------------------------------------------

export interface ReportDraftSegmentInput {
  id: ID;
  startMs: number;
  endMs: number;
  tags?: string[];
  /** 该片段的量化指标（姿态分析按时间窗聚合） */
  metrics?: SegmentMetrics;
}

/** 姿态指标（ai-service stub 产出，可缺省） */
/**
 * 姿态测量汇总（ai-service 真实分析产出；字段均可选，缺省表示未测量）。
 * 保留索引签名以兼容附加指标。
 */
export interface PoseMetrics {
  /** 出拳次数（腕速峰值检测） */
  punchCount?: number;
  /** 每分钟出拳数 */
  punchesPerMin?: number;
  /** 护手到位率 0~1（双腕高于肩线时长占比） */
  guardUpRatio?: number;
  /** 平均站距 / 肩宽 */
  stanceWidthRatio?: number;
  /** 高强度活动时间占比 0~1（出拳串 + 高活动片段） */
  highActivityRatio?: number;
  /** 姿态检出率 0~1（采样帧中检到人体的比例，可作可信度参考） */
  detectRate?: number;
  /** 分析采样帧数 */
  analyzedFrames?: number;
  /** 实际采样帧率 */
  sampleFps?: number;
  /** 全视频拳型分布（straight / hook_swing / uppercut → 次数） */
  punchTypes?: Record<string, number>;
  /** 全视频躲闪次数（slip/duck） */
  evadeCount?: number;
  /** 逐拳事件（时间点 + 拳型），供时间轴拳型轨渲染 */
  punchEvents?: PunchEventDTO[];
  [key: string]:
    | number
    | string
    | Record<string, number>
    | PunchEventDTO[]
    | undefined;
}

/** 拳型粗分类（单机位 2D 轨迹判定：直拳 / 勾摆 / 上勾） */
export type PunchKind = "straight" | "hook_swing" | "uppercut";

/** 逐拳事件（全视频，供时间轴拳型轨渲染） */
export interface PunchEventDTO {
  /** 事件时间点（ms） */
  tMs: number;
  /** 拳型 */
  kind: PunchKind;
  /** 腕速（肩宽/秒） */
  speed?: number;
}

/** 片段级量化指标（ai-service 按片段时间窗聚合） */
export interface SegmentMetrics {
  /** 片段内出拳次数 */
  punchCount?: number;
  /** 平均出拳腕速（肩宽/秒） */
  avgPunchSpeed?: number;
  /** 片段内拳型分布 */
  punchTypes?: Record<string, number>;
  /** 片段内躲闪次数（slip/duck） */
  evadeCount?: number;
  /** 平均活动度（肩宽/秒） */
  activity?: number;
  /** 步伐强度（踝部位移密度） */
  footworkIntensity?: number;
  /** 护手到位率 0~1 */
  guardUpRatio?: number;
  [key: string]: number | Record<string, number> | undefined;
}

/** ai-service 产出的动作片段主标签 */
export type ActionSegmentLabel =
  | "punch_burst"
  | "evade"
  | "footwork"
  | "guard_hold"
  | "high_activity"
  | "rest"
  | "low_activity"; // 兼容存量数据（已被 rest 取代）

/** LLM 起草报告的结构化输入 */
export interface ReportDraftInput {
  trainingType: TrainingType;
  userNote?: string;
  segments: ReportDraftSegmentInput[];
  poseMetrics?: PoseMetrics;
}

/** LLM 起草报告的结构化输出 */
export interface ReportDraftScore {
  dimension: ScoreDimension;
  aiScore: number;
  confidence: number;
  rationale?: string;
  evidenceSegmentIds?: ID[];
}

export interface ReportDraftOutput {
  summary: string;
  items: AnalysisReportItem[];
  scores: ReportDraftScore[];
}

// ---------------------------------------------------------------------------
// 趋势聚合
// ---------------------------------------------------------------------------

export interface WeeklyMetric {
  userId: ID;
  weekStart: ISODateString;
  dimension: ScoreDimension;
  avgScore: number;
  sessionCount: number;
}
