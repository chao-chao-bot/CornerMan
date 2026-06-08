"""CornerMan · ai-service（姿态分析，骨架）

职责：从视频帧中**测量**身体姿态，量化动作，输出关键点坐标、角度、出拳候选、
置信度等数字指标。不产出自然语言（自然语言复盘由 LLM 负责）。

MVP 务实路径：/analyze 先返回 stub 占位数据，优先跑通
video-worker -> LLM -> 报告 链路，姿态测量后补（见 docs/tech-design.md 7.4）。
"""
from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="CornerMan ai-service", version="0.0.0")


class AnalyzeRequest(BaseModel):
    session_id: str
    # 抽帧后的帧图 URL（OSS 签名 URL）序列
    frame_urls: list[str] = []
    # 粗切片时间轴（毫秒）
    segments: list[dict] = []


class PoseMetric(BaseModel):
    segment_index: int
    # 关键点 / 角度等量化指标占位
    keypoints: list[dict] = []
    angles: dict = {}
    punch_candidates: list[dict] = []
    confidence: float = 0.0


class AnalyzeResponse(BaseModel):
    session_id: str
    stub: bool
    metrics: list[PoseMetric] = []


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "cornerman-ai-service"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    # 占位实现：返回 stub 指标。后续接入 MediaPipe / RTMPose。
    metrics = [
        PoseMetric(segment_index=i, confidence=0.0)
        for i, _ in enumerate(req.segments)
    ]
    return AnalyzeResponse(session_id=req.session_id, stub=True, metrics=metrics)
