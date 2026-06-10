# ai-service（姿态分析）

CornerMan 的自部署视觉计算服务：MediaPipe Pose（CPU）从视频测量身体姿态，
产出**动作片段**（出拳串 / 高活动 / 低活动）与量化指标（出拳次数、护手到位率、
站距、活动占比），供 video-worker 做动作驱动切片、供 LLM 撰写复盘。

## 角色边界

- 只做**测量**（关键点、速度、动作片段、置信度），不产出自然语言。
- 自然语言复盘由 LLM 负责，见 `packages/ai-prompts`。
- mediapipe 不可用 / 视频中检不到人时返回 `stub: true`，video-worker 回退机械切片，链路永不阻塞。

## 本地运行

mediapipe 要求 Python 3.10–3.12（3.13+ 暂无 wheel）。推荐 `uv` 指定解释器：

```bash
cd apps/ai-service
uv venv --python 3.11 .venv && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --port 5000
```

- 健康检查：`GET /health`（`pose_available` 表示 mediapipe 是否就绪）
- 分析：`POST /analyze`，入参 `{ session_id, video_url }`（签名的 360p URL）

## 分析流程（app/pose.py）

1. OpenCV 按 ~8fps 采样，MediaPipe Pose（lite 模型）逐帧关键点；
2. 腕速峰值（按肩宽归一化，阈值 4 肩宽/秒）→ 出拳候选，聚类成 `punch_burst` 片段；
3. 每秒运动密度（自适应阈值）→ `high_activity` / `low_activity` 区间；
4. 护手到位率（双腕高于肩线时长占比）、站距/肩宽等姿态统计 → `summary`。
