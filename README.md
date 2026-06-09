# CornerMan 拳角

> 拳击训练后的 AI 复盘教练。把每次私教、自训、实战的视频和感受沉淀为可追踪的训练报告，让你知道这次练了什么、哪里有问题、下次该练什么。

`cornerman` 取自拳击比赛回合间站在角落给选手复盘、布置下一回合战术的人，对应产品定位：**训练后 AI 复盘平台**。

## 文档索引

- [产品调研](docs/product-research.md)：市场判断、竞品矩阵、机会与风险
- [产品需求文档（MVP）](docs/prd.md)：目标用户、功能范围、评分体系、里程碑
- [技术设计文档（MVP）](docs/tech-design.md)：monorepo 架构、技术选型、AI 流水线、部署方案

## 工程总览

- Monorepo：`pnpm workspaces` + `Turborepo`
- 后端：`NestJS`（Node）+ `FastAPI`（Python AI 子服务）
- 前端：`Next.js 14` App Router，PC 优先 + 响应式兼容移动端 H5
- 数据：PostgreSQL + Redis + 阿里云 OSS
- 部署区域：中国大陆（阿里云）

详见 [docs/tech-design.md](docs/tech-design.md)。

## 工程结构

```
CornerMan/
├── apps/
│   ├── web/               # Next.js 14 App Router（PC 优先 + H5 兼容）
│   ├── api/               # NestJS 主后端
│   ├── video-worker/      # Node + BullMQ + ffmpeg 视频处理
│   └── ai-service/        # Python FastAPI 姿态分析
├── packages/
│   ├── shared-types/      # 跨端 TS 类型
│   ├── api-client/        # 前端调用 api 的 SDK
│   ├── ui/                # 响应式组件库（Coach Lab 设计令牌）
│   ├── ai-prompts/        # LLM prompt 模板
│   └── config/            # eslint / tsconfig / tailwind 预设
├── infra/                 # docker-compose（Postgres/Redis/MinIO）、.env.example、deploy
├── docs/                  # 产品调研 / PRD / 技术设计
└── design-preview/        # Coach Lab 静态视觉预览
```

## 本地启动

> 当前为工程骨架，模块多为占位，尚未实现业务逻辑。

```bash
# 1. 安装依赖（Node 20+，pnpm 9）
pnpm install

# 2. 准备容器 runtime（Podman，开源，无需 Docker Desktop）
#    首次需安装并初始化一个 Linux VM：
brew install podman podman-compose
podman machine init   # 仅首次，下载 VM 镜像
podman machine start

# 3. 启动本地依赖（Postgres / Redis / MinIO）
pnpm infra:up         # 等价于 podman-compose -f infra/docker-compose.yml up -d

# 4. 配置环境变量
cp infra/.env.example .env

# 5. 启动全部 Node 服务（web / api / video-worker）
pnpm dev

# 6. 启动 Python 姿态分析服务
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5000
```

默认端口：web `3000`、api `4000`、ai-service `5000`、MinIO 控制台 `9001`。
