/** 报告页跨栏联动的共享类型 */

/** 报告侧 → 视频侧：请求跳转播放 */
export type SeekRequest = { videoId: string; ms: number; nonce: number };

/** 视频侧 → 报告侧：请求定位某个复盘条目/评分 */
export type LocateRequest = { refKey: string; nonce: number };

/** 报告面板上抛给详情页的进度摘要，用于阶段条与 CTA */
export interface ReportProgress {
  hasDraft: boolean;
  hasFinal: boolean;
  /** 当前 active 报告的条目总数 */
  totalItems: number;
  /** 已处理条目数（采纳或修改过） */
  handledItems: number;
}

/**
 * 视频序号映射：按上传时间（createdAt）升序编号，从 1 开始。
 * 报告证据 chip 与视频卡片标题共用该编号，多视频时跳转更直观。
 */
export function buildVideoIndexMap(
  videos: { id: string; createdAt: string }[]
): Map<string, number> {
  const sorted = [...videos].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const map = new Map<string, number>();
  sorted.forEach((v, i) => map.set(v.id, i + 1));
  return map;
}

/** 报告引用的证据片段（条目或评分 → 片段） */
export interface EvidenceRef {
  segmentId: string;
  /** item = 复盘条目引用；score = 评分证据引用 */
  kind: "item" | "score";
  /** 反向定位键：条目为 item.key，评分为 `score-<dimension>` */
  refKey: string;
  /** 展示用：条目标题或维度名 */
  label: string;
}
