/** 报告页跨栏联动的共享类型 */

/** 报告侧 → 视频侧：请求跳转播放 */
export type SeekRequest = { videoId: string; ms: number; nonce: number };

/** 视频侧 → 报告侧：请求定位某个复盘条目/评分 */
export type LocateRequest = { refKey: string; nonce: number };

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
