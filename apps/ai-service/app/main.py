"""CornerMan · ai-service（姿态分析）

职责：从视频中**测量**身体姿态，量化动作，输出动作片段（出拳串/高低活动）、
出拳次数、护手到位率等数字指标。不产出自然语言（自然语言复盘由 LLM 负责）。

实现：MediaPipe Pose（lite，CPU）+ OpenCV ~8fps 采样，见 app/pose.py。
mediapipe 不可用或分析失败时降级返回 stub 响应（stub=true），调用方据此回退机械切片。
"""
from __future__ import annotations

import tempfile
import urllib.request
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from . import pose as pose_mod

app = FastAPI(title="CornerMan ai-service", version="0.1.0")

DOWNLOAD_TIMEOUT_SEC = 120


class AnalyzeRequest(BaseModel):
    session_id: str
    # 签名的视频 URL（建议 360p 转码版，下载快、姿态估计精度足够）
    video_url: str | None = None
    # 兼容旧入参（已不使用）
    frame_urls: list[str] = []
    segments: list[dict] = []


class ActionSegmentOut(BaseModel):
    start_ms: int
    end_ms: int
    label: str  # punch_burst | evade | footwork | guard_hold | high_activity | rest
    confidence: float
    # 主标签 + 副标签（拳型 / combo / moving / with_evade）
    tags: list[str] = []
    # 该片段的量化指标（punchCount / avgPunchSpeed / punchTypes / evadeCount / ...）
    metrics: dict = {}


class AnalyzeSummary(BaseModel):
    duration_ms: int
    sample_fps: float
    analyzed_frames: int
    detect_rate: float
    punch_count: int
    punches_per_min: float
    guard_up_ratio: float
    stance_width_ratio: float | None = None
    high_activity_ratio: float
    # 全视频躲闪次数
    evade_count: int = 0
    # 全视频拳型分布
    punch_types: dict = {}


class PunchEventOut(BaseModel):
    t_ms: int
    kind: str  # straight | hook_swing | uppercut
    speed: float


class AnalyzeResponse(BaseModel):
    session_id: str
    stub: bool
    reason: str | None = None
    action_segments: list[ActionSegmentOut] = []
    summary: AnalyzeSummary | None = None
    # 逐拳事件（全视频，供前端时间轴拳型轨渲染）
    punch_events: list[PunchEventOut] = []
    # 兼容旧响应字段
    metrics: list[dict] = []


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "cornerman-ai-service",
        "pose_available": pose_mod.POSE_AVAILABLE,
    }


def _stub(req: AnalyzeRequest, reason: str) -> AnalyzeResponse:
    return AnalyzeResponse(session_id=req.session_id, stub=True, reason=reason)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    if not pose_mod.POSE_AVAILABLE:
        return _stub(req, "mediapipe 未安装")
    if not req.video_url:
        return _stub(req, "缺少 video_url")

    try:
        with tempfile.TemporaryDirectory(prefix="cm-pose-") as tmp:
            video_path = str(Path(tmp) / "video.mp4")
            with urllib.request.urlopen(req.video_url, timeout=DOWNLOAD_TIMEOUT_SEC) as resp, open(
                video_path, "wb"
            ) as f:
                while chunk := resp.read(1 << 20):
                    f.write(chunk)
            result = pose_mod.analyze_video(video_path)
    except pose_mod.PoseNotDetected as err:
        return _stub(req, str(err))
    except Exception as err:  # 下载失败 / 解码失败等，一律降级
        return _stub(req, f"分析失败：{err}")

    return AnalyzeResponse(
        session_id=req.session_id,
        stub=False,
        action_segments=[
            ActionSegmentOut(
                start_ms=s.start_ms,
                end_ms=s.end_ms,
                label=s.label,
                confidence=s.confidence,
                tags=s.tags,
                metrics=s.metrics,
            )
            for s in result.segments
        ],
        summary=AnalyzeSummary(
            duration_ms=result.duration_ms,
            sample_fps=result.sample_fps,
            analyzed_frames=result.analyzed_frames,
            detect_rate=result.detect_rate,
            punch_count=result.punch_count,
            punches_per_min=result.punches_per_min,
            guard_up_ratio=result.guard_up_ratio,
            stance_width_ratio=result.stance_width_ratio,
            high_activity_ratio=result.high_activity_ratio,
            evade_count=result.evade_count,
            punch_types=result.punch_types,
        ),
        punch_events=[
            PunchEventOut(t_ms=int(p.t_ms), kind=p.kind, speed=round(p.speed, 2))
            for p in result.punch_events
        ],
    )
