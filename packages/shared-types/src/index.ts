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
// 训练与视频
// ---------------------------------------------------------------------------

export type TrainingType = "private_lesson" | "self_training" | "sparring";

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
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** 列表页报告状态：尚无报告（视频处理中/待上传）/ AI 草稿待复盘 / 用户已定稿 */
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

/** 训练 session 的报告聚合响应 */
export interface SessionReportDTO {
  draft: ReportDTO | null;
  final: ReportDTO | null;
  scores: ScoreDTO[];
  revisions: RevisionDTO[];
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
}

/** 姿态指标（ai-service stub 产出，可缺省） */
export interface PoseMetrics {
  [key: string]: number | string | undefined;
}

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
