"""姿态分析核心：MediaPipe Pose 逐帧关键点 → 动作指标与动作片段。

只做测量与切分，不产出自然语言。所有速度/位移均以"肩宽"为单位做尺度归一化，
从而对分辨率、人物远近不敏感。所有阈值为绝对值（肩宽归一化后跨视频可比），
不再使用"本视频分位数"自适应——否则"全程在动"的视频永远达不到自身高分位。

片段标签体系 = 主标签（互斥） + 副标签（可叠加在出拳串上）：

主标签：
- punch_burst    出拳串
- evade          躲闪（头部横移 slip / 下潜回升 duck-weave，且无出拳）
- footwork       步伐移动密集时段（踝部位移驱动）
- guard_hold     护手保持高位且无出拳的防守时段
- high_activity  原地高强度（兜底）
- rest           休息/间歇

副标签（叠加在 punch_burst 上）：
- straight / hook_swing / uppercut  主要拳型（2D 轨迹粗分类）
- combo       组合拳（串内连续 ≥3 拳且相邻间隔 <1s）
- moving      移动中出拳（该串步伐强度达标）
- with_evade  含躲闪（串时间窗内检测到躲闪事件）

拳型为单机位 2D 轨迹粗分类：径向伸展为直拳、水平横向为勾/摆、向上为上勾，
精确拳种与角度纠错不在本层职责内。
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

try:  # mediapipe / cv2 缺失时由调用方降级 stub
    import cv2
    import mediapipe as mp

    POSE_AVAILABLE = True
except Exception:  # pragma: no cover
    POSE_AVAILABLE = False

# MediaPipe Pose 关键点索引
NOSE = 0
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_ANKLE, R_ANKLE = 27, 28

MOTION_POINTS = [L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST, L_HIP, R_HIP]

TARGET_FPS = 8.0
# 出拳判定：腕速峰值（肩宽/秒）
PUNCH_SPEED_TH = 4.0
# 两次出拳最小间隔
PUNCH_MIN_GAP_MS = 250
# 出拳串聚类：相邻出拳间隔小于该值归入同一串
BURST_GAP_MS = 1200
BURST_PAD_BEFORE_MS = 800
BURST_PAD_AFTER_MS = 1200
MIN_SEG_MS = 3000
MAX_SEG_MS = 10000
# 有效检出率低于此值视为"画面里没拍到人"，让调用方走机械切片
MIN_DETECT_RATE = 0.2
# 拳型分类：垂直向上 / 径向分量占比阈值
KIND_UP_RATIO = 0.55
KIND_RADIAL_RATIO = 0.6

# ---- 绝对阈值（肩宽归一化，跨视频可比） ----
# 步伐移动：每秒踝部位移密度
FOOTWORK_TH = 0.8
# 原地高强度：每秒整体运动密度
HIGH_ACTIVITY_TH = 1.5
# 防守保持：该秒护手到位帧占比
GUARD_HOLD_SEC_RATIO = 0.6
# 躲闪 slip：头部横向速度（肩宽/秒）
EVADE_SLIP_SPEED_TH = 1.2
# 躲闪 duck：头部相对肩线下潜深度（肩宽）
EVADE_DUCK_DEPTH_TH = 0.5
# 躲闪事件聚类间隔 / 出拳排除窗口
EVADE_GAP_MS = 2000
EVADE_NEAR_PUNCH_MS = 400
# 组合拳：连续 N 拳且相邻间隔 < gap
COMBO_MIN_PUNCHES = 3
COMBO_GAP_MS = 1000


class PoseNotDetected(Exception):
    """视频中几乎检不到人体姿态。"""


@dataclass
class PunchEvent:
    t_ms: float
    speed: float
    confidence: float
    kind: str = "straight"  # straight | hook_swing | uppercut


@dataclass
class EvadeEvent:
    t_ms: float
    kind: str  # slip | duck
    confidence: float


@dataclass
class ActionSegment:
    start_ms: int
    end_ms: int
    label: str  # punch_burst | evade | footwork | guard_hold | high_activity | rest
    confidence: float
    tags: list[str] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)


@dataclass
class VideoAnalysis:
    duration_ms: int
    sample_fps: float
    analyzed_frames: int
    detect_rate: float
    punch_count: int
    punches_per_min: float
    guard_up_ratio: float
    stance_width_ratio: float | None
    high_activity_ratio: float
    evade_count: int = 0
    punch_types: dict = field(default_factory=dict)
    segments: list[ActionSegment] = field(default_factory=list)
    punch_events: list[PunchEvent] = field(default_factory=list)


def _dist(a, b) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _sample_landmarks(video_path: str):
    """按 ~TARGET_FPS 采样，逐帧跑 MediaPipe Pose。返回 (samples, duration_ms)。"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"无法打开视频：{video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if fps <= 0 or fps > 240:
        fps = 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_ms = int(total / fps * 1000) if total > 0 else 0
    step = max(1, round(fps / TARGET_FPS))

    samples: list[tuple[float, object]] = []  # (t_ms, landmarks|None)
    with mp.solutions.pose.Pose(
        model_complexity=0,
        static_image_mode=False,
        min_detection_confidence=0.4,
        min_tracking_confidence=0.4,
    ) as pose:
        idx = 0
        while True:
            ok = cap.grab()
            if not ok:
                break
            if idx % step == 0:
                ok, frame = cap.retrieve()
                if not ok:
                    break
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = pose.process(rgb)
                t_ms = idx / fps * 1000
                samples.append((t_ms, res.pose_landmarks))
            idx += 1
    cap.release()

    if duration_ms <= 0 and samples:
        duration_ms = int(samples[-1][0])
    return samples, duration_ms, fps / step


def _classify_punch(pts, prev_pts, wrist: int, speed_up: float, speed_total: float) -> str:
    """按腕部轨迹方向粗分类拳型。

    - uppercut：向上分量占主导（图像 y 向下，向上为负）
    - straight：相对同侧肩的径向伸展占主导（拳远离躯干打直）
    - hook_swing：其余的横向弧线（勾/摆在 2D 下难以区分，合并一类）
    """
    if speed_total <= 0:
        return "straight"
    if speed_up / speed_total >= KIND_UP_RATIO:
        return "uppercut"
    shoulder = L_SHOULDER if wrist == L_WRIST else R_SHOULDER
    radial = abs(_dist(pts[wrist], pts[shoulder]) - _dist(prev_pts[wrist], prev_pts[shoulder]))
    move = _dist(pts[wrist], prev_pts[wrist])
    if move > 0 and radial / move >= KIND_RADIAL_RATIO:
        return "straight"
    return "hook_swing"


def _detect_punches(samples) -> list[PunchEvent]:
    """腕速峰值 → 出拳候选（双手合并，最小间隔去重），附带拳型粗分类。"""
    events: list[PunchEvent] = []
    prev_t, prev_lm = None, None
    for t_ms, lm in samples:
        if lm is None:
            prev_t, prev_lm = None, None
            continue
        if prev_lm is not None:
            dt = (t_ms - prev_t) / 1000
            if dt > 0:
                pts, prev_pts = lm.landmark, prev_lm.landmark
                shoulder_w = max(
                    (_dist(pts[L_SHOULDER], pts[R_SHOULDER]) + _dist(prev_pts[L_SHOULDER], prev_pts[R_SHOULDER])) / 2,
                    0.05,
                )
                for wrist in (L_WRIST, R_WRIST):
                    vis = min(pts[wrist].visibility, prev_pts[wrist].visibility)
                    if vis < 0.5:
                        continue
                    speed = _dist(pts[wrist], prev_pts[wrist]) / dt / shoulder_w
                    if speed >= PUNCH_SPEED_TH:
                        conf = min(1.0, speed / (PUNCH_SPEED_TH * 2)) * vis
                        speed_up = max(0.0, (prev_pts[wrist].y - pts[wrist].y) / dt / shoulder_w)
                        kind = _classify_punch(pts, prev_pts, wrist, speed_up, speed)
                        events.append(
                            PunchEvent(t_ms=t_ms, speed=speed, confidence=round(conf, 3), kind=kind)
                        )
        prev_t, prev_lm = t_ms, lm

    # 同一拳可能在双手/相邻帧重复命中：按时间排序后做最小间隔去重（保留更快的）
    events.sort(key=lambda e: e.t_ms)
    deduped: list[PunchEvent] = []
    for ev in events:
        if deduped and ev.t_ms - deduped[-1].t_ms < PUNCH_MIN_GAP_MS:
            if ev.speed > deduped[-1].speed:
                deduped[-1] = ev
        else:
            deduped.append(ev)
    return deduped


def _detect_evades(samples, punches: list[PunchEvent]) -> list[EvadeEvent]:
    """躲闪检测：头部（NOSE）相对肩部的快速横移（slip）或下潜回升（duck/weave）。

    用"头相对肩线"而非头的绝对位移，排除整体走动带来的假阳性；
    出拳前后 EVADE_NEAR_PUNCH_MS 内的头动视为出拳带动，排除。
    """
    punch_ts = [p.t_ms for p in punches]

    def near_punch(t_ms: float) -> bool:
        return any(abs(t_ms - pt) <= EVADE_NEAR_PUNCH_MS for pt in punch_ts)

    events: list[EvadeEvent] = []
    prev_t, prev_lm = None, None
    # duck 状态机：记录下潜起点的相对深度
    duck_base: float | None = None
    duck_start_ms = 0.0

    for t_ms, lm in samples:
        if lm is None:
            prev_t, prev_lm = None, None
            duck_base = None
            continue
        pts = lm.landmark
        if pts[NOSE].visibility < 0.5:
            prev_t, prev_lm = t_ms, lm
            continue
        shoulder_w = max(_dist(pts[L_SHOULDER], pts[R_SHOULDER]), 0.05)
        shoulder_y = (pts[L_SHOULDER].y + pts[R_SHOULDER].y) / 2
        shoulder_x = (pts[L_SHOULDER].x + pts[R_SHOULDER].x) / 2
        # 头相对肩的位置（肩宽单位；y 向下为正 → 下潜时变大）
        rel_x = (pts[NOSE].x - shoulder_x) / shoulder_w
        rel_y = (pts[NOSE].y - shoulder_y) / shoulder_w

        if prev_lm is not None and prev_t is not None:
            dt = (t_ms - prev_t) / 1000
            if dt > 0:
                prev_pts = prev_lm.landmark
                prev_sw = max(_dist(prev_pts[L_SHOULDER], prev_pts[R_SHOULDER]), 0.05)
                prev_sx = (prev_pts[L_SHOULDER].x + prev_pts[R_SHOULDER].x) / 2
                prev_rel_x = (prev_pts[NOSE].x - prev_sx) / prev_sw
                slip_speed = abs(rel_x - prev_rel_x) / dt
                if slip_speed >= EVADE_SLIP_SPEED_TH and not near_punch(t_ms):
                    conf = min(1.0, slip_speed / (EVADE_SLIP_SPEED_TH * 2))
                    events.append(EvadeEvent(t_ms=t_ms, kind="slip", confidence=round(conf, 3)))

        # duck：头相对肩明显下沉后回升
        if duck_base is None:
            duck_base = rel_y
            duck_start_ms = t_ms
        else:
            depth = rel_y - duck_base
            if depth >= EVADE_DUCK_DEPTH_TH:
                if not near_punch(t_ms):
                    conf = min(1.0, depth / (EVADE_DUCK_DEPTH_TH * 2))
                    events.append(
                        EvadeEvent(t_ms=(duck_start_ms + t_ms) / 2, kind="duck", confidence=round(conf, 3))
                    )
                duck_base = rel_y  # 重置基线，等待回升
            elif rel_y < duck_base:
                duck_base = rel_y  # 跟踪最高位作为基线
                duck_start_ms = t_ms

        prev_t, prev_lm = t_ms, lm

    # 去重：相邻 500ms 内只保留置信度最高的
    events.sort(key=lambda e: e.t_ms)
    deduped: list[EvadeEvent] = []
    for ev in events:
        if deduped and ev.t_ms - deduped[-1].t_ms < 500:
            if ev.confidence > deduped[-1].confidence:
                deduped[-1] = ev
        else:
            deduped.append(ev)
    return deduped


def _per_second_motion(samples, points: list[int], vis_points: list[int] | None = None) -> dict[int, float]:
    """每秒运动密度：指定关键点平均位移（肩宽/秒），按 1s 桶聚合取均值。"""
    buckets: dict[int, list[float]] = {}
    prev_t, prev_lm = None, None
    for t_ms, lm in samples:
        if lm is None:
            prev_t, prev_lm = None, None
            continue
        if prev_lm is not None:
            dt = (t_ms - prev_t) / 1000
            if dt > 0:
                pts, prev_pts = lm.landmark, prev_lm.landmark
                if vis_points and any(
                    min(pts[i].visibility, prev_pts[i].visibility) < 0.5 for i in vis_points
                ):
                    prev_t, prev_lm = t_ms, lm
                    continue
                shoulder_w = max(_dist(pts[L_SHOULDER], pts[R_SHOULDER]), 0.05)
                disp = sum(_dist(pts[i], prev_pts[i]) for i in points) / len(points)
                buckets.setdefault(int(t_ms // 1000), []).append(disp / dt / shoulder_w)
        prev_t, prev_lm = t_ms, lm
    return {sec: sum(v) / len(v) for sec, v in buckets.items()}


def _per_second_activity(samples) -> dict[int, float]:
    """每秒整体运动密度（上肢+躯干）。"""
    return _per_second_motion(samples, MOTION_POINTS)


def _per_second_footwork(samples) -> dict[int, float]:
    """每秒步伐强度：踝部位移密度（肩宽/秒）。"""
    return _per_second_motion(samples, [L_ANKLE, R_ANKLE], vis_points=[L_ANKLE, R_ANKLE])


def _guard_frame_ok(pts) -> bool:
    """护手到位：至少一腕高于下巴线（鼻与肩线中点，图像 y 向下）。"""
    shoulder_y = (pts[L_SHOULDER].y + pts[R_SHOULDER].y) / 2
    chin_y = (pts[NOSE].y + shoulder_y) / 2
    return pts[L_WRIST].y < chin_y or pts[R_WRIST].y < chin_y


def _per_second_guard(samples) -> dict[int, float]:
    """每秒护手到位帧占比。"""
    buckets: dict[int, list[int]] = {}
    for t_ms, lm in samples:
        if lm is None:
            continue
        pts = lm.landmark
        if min(pts[L_WRIST].visibility, pts[R_WRIST].visibility) < 0.5:
            continue
        buckets.setdefault(int(t_ms // 1000), []).append(1 if _guard_frame_ok(pts) else 0)
    return {sec: sum(v) / len(v) for sec, v in buckets.items()}


def _posture_stats(samples) -> tuple[float, float | None]:
    """返回 (护手到位率, 平均站距/肩宽)。"""
    guard_hits, guard_total = 0, 0
    stance_ratios: list[float] = []
    for _, lm in samples:
        if lm is None:
            continue
        pts = lm.landmark
        if min(pts[L_WRIST].visibility, pts[R_WRIST].visibility) >= 0.5:
            guard_total += 1
            if _guard_frame_ok(pts):
                guard_hits += 1
        if min(pts[L_ANKLE].visibility, pts[R_ANKLE].visibility) >= 0.5:
            shoulder_w = max(_dist(pts[L_SHOULDER], pts[R_SHOULDER]), 0.05)
            stance_ratios.append(_dist(pts[L_ANKLE], pts[R_ANKLE]) / shoulder_w)
    guard_ratio = guard_hits / guard_total if guard_total else 0.0
    stance = sum(stance_ratios) / len(stance_ratios) if stance_ratios else None
    return round(guard_ratio, 3), (round(stance, 2) if stance is not None else None)


def _clip(v: int, lo: int, hi: int) -> int:
    return max(lo, min(v, hi))


def _split_cluster(cl: list[PunchEvent]) -> list[list[PunchEvent]]:
    """出拳串超过 MAX_SEG_MS 时，在拳间隔最大处递归切开（切点更自然）。"""
    span = cl[-1].t_ms - cl[0].t_ms + BURST_PAD_BEFORE_MS + BURST_PAD_AFTER_MS
    if span <= MAX_SEG_MS or len(cl) < 2:
        return [cl]
    gap_idx = max(range(len(cl) - 1), key=lambda i: cl[i + 1].t_ms - cl[i].t_ms)
    return _split_cluster(cl[: gap_idx + 1]) + _split_cluster(cl[gap_idx + 1 :])


def _split_max(start: int, end: int, label: str, conf: float) -> list[ActionSegment]:
    """超过 MAX_SEG_MS 的同质段按固定步长切开（用于活动度/步伐 run）。"""
    out = []
    cur = start
    while end - cur > MAX_SEG_MS:
        out.append(ActionSegment(cur, cur + MAX_SEG_MS, label, conf))
        cur += MAX_SEG_MS
    out.append(ActionSegment(cur, end, label, conf))
    return out


def _cluster_events(ts: list[float], gap_ms: float) -> list[tuple[float, float]]:
    """时间点按间隔聚类，返回 (start_ms, end_ms) 列表。"""
    if not ts:
        return []
    out: list[list[float]] = [[ts[0], ts[0]]]
    for t in ts[1:]:
        if t - out[-1][1] <= gap_ms:
            out[-1][1] = t
        else:
            out.append([t, t])
    return [(s, e) for s, e in out]


def _build_segments(
    duration_ms: int,
    punches: list[PunchEvent],
    evades: list[EvadeEvent],
    activity: dict[int, float],
    footwork: dict[int, float],
    guard_sec: dict[int, float],
) -> list[ActionSegment]:
    segments: list[ActionSegment] = []

    # 1) 出拳串：间隔 <= BURST_GAP_MS 的出拳聚成一串；过长的串在拳间隔最大处切开
    clusters: list[list[PunchEvent]] = []
    for ev in punches:
        if clusters and ev.t_ms - clusters[-1][-1].t_ms <= BURST_GAP_MS:
            clusters[-1].append(ev)
        else:
            clusters.append([ev])
    sub_clusters: list[list[PunchEvent]] = []
    for cl in clusters:
        sub_clusters.extend(_split_cluster(cl))
    for cl in sub_clusters:
        start = _clip(int(cl[0].t_ms - BURST_PAD_BEFORE_MS), 0, duration_ms)
        end = _clip(int(cl[-1].t_ms + BURST_PAD_AFTER_MS), 0, duration_ms)
        if end - start < MIN_SEG_MS:  # 居中扩到最小时长
            pad = (MIN_SEG_MS - (end - start)) // 2
            start = _clip(start - pad, 0, duration_ms)
            end = _clip(start + MIN_SEG_MS, 0, duration_ms)
        conf = round(sum(e.confidence for e in cl) / len(cl), 3)
        segments.append(ActionSegment(start, end, "punch_burst", conf))

    # 出拳串去重叠：能合并且不超上限则合并，否则在重叠中点切开（保住细粒度）
    segments.sort(key=lambda s: s.start_ms)
    merged: list[ActionSegment] = []
    for seg in segments:
        if merged and seg.start_ms < merged[-1].end_ms:
            if seg.end_ms - merged[-1].start_ms <= MAX_SEG_MS:
                merged[-1].end_ms = max(merged[-1].end_ms, seg.end_ms)
                merged[-1].confidence = max(merged[-1].confidence, seg.confidence)
            else:
                mid = (seg.start_ms + merged[-1].end_ms) // 2
                merged[-1].end_ms = mid
                seg.start_ms = mid
                merged.append(seg)
        else:
            merged.append(seg)
    segments = merged

    # 2) 出拳串之外的躲闪事件 → evade 片段（事件聚类，pad 到最小时长）
    covered = [(s.start_ms, s.end_ms) for s in segments]

    def in_covered(t_ms: float) -> bool:
        return any(cs <= t_ms < ce for cs, ce in covered)

    free_evades = [e for e in evades if not in_covered(e.t_ms)]
    for es, ee in _cluster_events([e.t_ms for e in free_evades], EVADE_GAP_MS):
        start = _clip(int(es - 800), 0, duration_ms)
        end = _clip(int(ee + 800), 0, duration_ms)
        if end - start < MIN_SEG_MS:
            pad = (MIN_SEG_MS - (end - start)) // 2
            start = _clip(start - pad, 0, duration_ms)
            end = _clip(start + MIN_SEG_MS, 0, duration_ms)
        # 与已有片段重叠则放弃（保持主标签互斥简单性）
        if any(start < ce and end > cs for cs, ce in covered):
            continue
        in_win = [e for e in free_evades if es <= e.t_ms <= ee]
        conf = round(sum(e.confidence for e in in_win) / len(in_win), 3) if in_win else 0.5
        segments.append(ActionSegment(start, end, "evade", conf))
        covered.append((start, end))

    segments.sort(key=lambda s: s.start_ms)

    # 3) 未覆盖区间逐秒分类（绝对阈值）：footwork > guard_hold > high_activity > rest
    def classify_sec(sec: int) -> str:
        if footwork.get(sec, 0.0) >= FOOTWORK_TH:
            return "footwork"
        if guard_sec.get(sec, 0.0) >= GUARD_HOLD_SEC_RATIO:
            return "guard_hold"
        if activity.get(sec, 0.0) >= HIGH_ACTIVITY_TH:
            return "high_activity"
        return "rest"

    covered = [(s.start_ms, s.end_ms) for s in segments]
    gaps: list[tuple[int, int]] = []
    cursor = 0
    for cs, ce in covered:
        if cs - cursor >= MIN_SEG_MS:
            gaps.append((cursor, cs))
        cursor = max(cursor, ce)
    if duration_ms - cursor >= MIN_SEG_MS:
        gaps.append((cursor, duration_ms))

    SEG_CONF = {"footwork": 0.7, "guard_hold": 0.6, "high_activity": 0.7, "rest": 0.5}
    for gs, ge in gaps:
        # 该 gap 内逐秒标注后做 run-length 合并
        sec_labels: list[tuple[int, str]] = []
        for sec in range(gs // 1000, max(ge // 1000, gs // 1000 + 1)):
            sec_labels.append((sec, classify_sec(sec)))
        if not sec_labels:
            continue
        run_start, run_label = sec_labels[0]
        prev_sec = run_start
        runs: list[tuple[int, int, str]] = []
        for sec, label in sec_labels[1:]:
            if label != run_label:
                runs.append((run_start, prev_sec + 1, run_label))
                run_start, run_label = sec, label
            prev_sec = sec
        runs.append((run_start, prev_sec + 1, run_label))

        # 过短的 run 并入前一段
        merged_runs: list[list] = []
        for rs, re, label in runs:
            if merged_runs and (re - rs) * 1000 < MIN_SEG_MS:
                merged_runs[-1][1] = re
            else:
                merged_runs.append([rs, re, label])
        for rs, re, label in merged_runs:
            start = _clip(rs * 1000, gs, ge)
            end = _clip(re * 1000, gs, ge)
            if end - start < MIN_SEG_MS:
                continue
            segments.extend(_split_max(start, end, label, SEG_CONF[label]))

    segments.sort(key=lambda s: s.start_ms)
    return [s for s in segments if s.end_ms - s.start_ms >= 1000]


def _enrich_segments(
    segments: list[ActionSegment],
    punches: list[PunchEvent],
    evades: list[EvadeEvent],
    activity: dict[int, float],
    footwork: dict[int, float],
    guard_sec: dict[int, float],
) -> None:
    """为每个片段填充 tags（主+副标签）与量化指标（按片段时间窗聚合）。"""

    def window_mean(d: dict[int, float], start_ms: int, end_ms: int) -> float | None:
        vals = [v for sec, v in d.items() if start_ms <= sec * 1000 < end_ms]
        return round(sum(vals) / len(vals), 3) if vals else None

    def has_combo(in_seg: list[PunchEvent]) -> bool:
        """串内是否存在连续 >= COMBO_MIN_PUNCHES 拳且相邻间隔 < COMBO_GAP_MS。"""
        run = 1
        for i in range(1, len(in_seg)):
            if in_seg[i].t_ms - in_seg[i - 1].t_ms < COMBO_GAP_MS:
                run += 1
                if run >= COMBO_MIN_PUNCHES:
                    return True
            else:
                run = 1
        return False

    for seg in segments:
        in_seg = [p for p in punches if seg.start_ms <= p.t_ms < seg.end_ms]
        in_evades = [e for e in evades if seg.start_ms <= e.t_ms < seg.end_ms]
        types: dict[str, int] = {}
        for p in in_seg:
            types[p.kind] = types.get(p.kind, 0) + 1

        metrics: dict = {"punchCount": len(in_seg)}
        if in_seg:
            metrics["avgPunchSpeed"] = round(sum(p.speed for p in in_seg) / len(in_seg), 2)
            metrics["punchTypes"] = types
        if in_evades:
            metrics["evadeCount"] = len(in_evades)
        act = window_mean(activity, seg.start_ms, seg.end_ms)
        if act is not None:
            metrics["activity"] = act
        fw = window_mean(footwork, seg.start_ms, seg.end_ms)
        if fw is not None:
            metrics["footworkIntensity"] = fw
        guard = window_mean(guard_sec, seg.start_ms, seg.end_ms)
        if guard is not None:
            metrics["guardUpRatio"] = guard
        seg.metrics = metrics

        # 主标签 + 副标签
        tags = [seg.label]
        if seg.label == "punch_burst":
            if types:
                tags.append(max(types, key=lambda k: types[k]))  # 主要拳型
            if has_combo(in_seg):
                tags.append("combo")
            if fw is not None and fw >= FOOTWORK_TH:
                tags.append("moving")
            if in_evades:
                tags.append("with_evade")
        seg.tags = tags


def analyze_video(video_path: str) -> VideoAnalysis:
    samples, duration_ms, sample_fps = _sample_landmarks(video_path)
    if not samples or duration_ms <= 0:
        raise PoseNotDetected("视频无有效帧")

    valid = sum(1 for _, lm in samples if lm is not None)
    detect_rate = valid / len(samples)
    if detect_rate < MIN_DETECT_RATE:
        raise PoseNotDetected(f"姿态检出率过低（{detect_rate:.0%}）")

    punches = _detect_punches(samples)
    evades = _detect_evades(samples, punches)
    activity = _per_second_activity(samples)
    footwork = _per_second_footwork(samples)
    guard_sec = _per_second_guard(samples)
    guard_ratio, stance_ratio = _posture_stats(samples)
    segments = _build_segments(duration_ms, punches, evades, activity, footwork, guard_sec)
    _enrich_segments(segments, punches, evades, activity, footwork, guard_sec)

    punch_types: dict[str, int] = {}
    for p in punches:
        punch_types[p.kind] = punch_types.get(p.kind, 0) + 1

    active_ms = sum(
        s.end_ms - s.start_ms
        for s in segments
        if s.label in ("punch_burst", "high_activity", "footwork", "evade")
    )
    return VideoAnalysis(
        duration_ms=duration_ms,
        sample_fps=round(sample_fps, 2),
        analyzed_frames=len(samples),
        detect_rate=round(detect_rate, 3),
        punch_count=len(punches),
        punches_per_min=round(len(punches) / (duration_ms / 60000), 1) if duration_ms else 0.0,
        guard_up_ratio=guard_ratio,
        stance_width_ratio=stance_ratio,
        high_activity_ratio=round(active_ms / duration_ms, 3) if duration_ms else 0.0,
        evade_count=len(evades),
        punch_types=punch_types,
        segments=segments,
        punch_events=punches,
    )
