# ai-service（姿态分析）

CornerMan 的自部署视觉计算服务，从视频帧测量身体姿态并量化动作，输出数字指标供 LLM 撰写复盘。

## 角色边界

- 只做**测量**（关键点、角度、出拳候选、置信度），不产出自然语言。
- 自然语言复盘由 LLM（通义千问-VL）负责，见 `packages/ai-prompts`。
- MVP 阶段 `/analyze` 返回 stub 数据，优先打通整体链路。

## 本地运行（骨架）

```bash
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5000
```

- 健康检查：`GET /health`
- 分析（stub）：`POST /analyze`
