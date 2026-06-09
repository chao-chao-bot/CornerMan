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
  userNote?: string;
}

/** 训练记录对外视图（列表/详情返回） */
export interface TrainingSessionDTO {
  id: ID;
  title: string;
  trainingType: TrainingType;
  trainedAt: ISODateString;
  userNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
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
// 趋势聚合
// ---------------------------------------------------------------------------

export interface WeeklyMetric {
  userId: ID;
  weekStart: ISODateString;
  dimension: ScoreDimension;
  avgScore: number;
  sessionCount: number;
}
