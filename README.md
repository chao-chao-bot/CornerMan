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
- 前端：`Next.js 14` App Router，移动端 H5 优先
- 数据：PostgreSQL + Redis + 阿里云 OSS
- 部署区域：中国大陆（阿里云）

详见 [docs/tech-design.md](docs/tech-design.md)。
