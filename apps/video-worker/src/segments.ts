export interface CandidateSegment {
  startMs: number;
  endMs: number;
}

const MIN_SEG_MS = 5000;
const MAX_SEG_MS = 30000;
const FALLBACK_WINDOW_MS = 15000;

/**
 * 由场景切点 + 总时长生成候选片段（MVP 启发式）。
 * 切点把视频分段；过短的段并入下一段，过长的段按 MAX 再切。
 * 无切点时退化为固定窗口切分。
 */
export function buildCandidateSegments(
  durationMs: number,
  sceneCutsSec: number[]
): CandidateSegment[] {
  if (durationMs <= 0) return [];

  const cutsMs = sceneCutsSec
    .map((s) => Math.round(s * 1000))
    .filter((ms) => ms > 0 && ms < durationMs)
    .sort((a, b) => a - b);

  const boundaries =
    cutsMs.length > 0
      ? [0, ...cutsMs, durationMs]
      : fixedWindowBoundaries(durationMs);

  const raw: CandidateSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    raw.push({ startMs: boundaries[i], endMs: boundaries[i + 1] });
  }

  return normalize(raw, durationMs);
}

function fixedWindowBoundaries(durationMs: number): number[] {
  const out = [0];
  for (let t = FALLBACK_WINDOW_MS; t < durationMs; t += FALLBACK_WINDOW_MS) {
    out.push(t);
  }
  out.push(durationMs);
  return out;
}

function normalize(
  segments: CandidateSegment[],
  durationMs: number
): CandidateSegment[] {
  const merged: CandidateSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && seg.endMs - prev.startMs <= MAX_SEG_MS && prev.endMs - prev.startMs < MIN_SEG_MS) {
      prev.endMs = seg.endMs; // 把过短段并入上一段
    } else {
      merged.push({ ...seg });
    }
  }

  const out: CandidateSegment[] = [];
  for (const seg of merged) {
    let start = seg.startMs;
    while (seg.endMs - start > MAX_SEG_MS) {
      out.push({ startMs: start, endMs: start + MAX_SEG_MS });
      start += MAX_SEG_MS;
    }
    out.push({ startMs: start, endMs: seg.endMs });
  }

  return out.filter((s) => s.endMs > s.startMs && s.endMs <= durationMs);
}
