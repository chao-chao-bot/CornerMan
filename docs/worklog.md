# CornerMan 工作日志

记录每次大型修改。新记录追加在最上方（倒序）。
每条字段：日期 / 范围 / 改动摘要 / 影响文件 / 备注。

## 2026-06-08 · 本地容器 runtime 由 Docker 切换为 Podman
- 范围：本地开发环境 + infra 文档
- 改动摘要：
  - 本地容器 runtime 改用 Podman + podman-compose（开源，免 Docker Desktop）；compose 服务定义不变
  - 根 `package.json` 新增 `infra:up` / `infra:down` / `infra:logs` 脚本（封装 podman-compose）
  - 更新文档：`infra/docker-compose.yml` 头注释、`README.md` 本地启动步骤（补 podman machine 前置）、`docs/tech-design.md` 技术栈表新增"本地容器 runtime"行
- 影响文件：`package.json`、`infra/docker-compose.yml`、`README.md`、`docs/tech-design.md`
- 验证：`pnpm infra:up` 拉起 postgres/redis/minio 成功；redis `PONG`、postgres accepting connections；video-worker 打印 `[video-worker] ready`
- 备注：生产部署仍沿用阿里云 ECS + Docker，compose 文件两端通用

## 2026-06-08 · 搭建 monorepo 骨架
- 范围：全仓初始化
- 改动摘要：
  - 新增根 workspace 配置：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`.gitignore`、`.npmrc`、`.nvmrc`
  - 新增 4 个 apps：`web`（Next.js 14）、`api`（NestJS，含 10 个模块空壳 + prisma schema 草稿）、`video-worker`（BullMQ）、`ai-service`（FastAPI，/health + /analyze stub）
  - 新增 5 个 packages：`config`、`shared-types`、`ui`、`api-client`、`ai-prompts`
  - 新增 `infra`：`docker-compose.yml`（Postgres/Redis/MinIO）、`.env.example`、`deploy/.gitkeep`
  - 更新根 `README.md`：工程结构图 + 本地启动说明
- 影响文件：`apps/**`、`packages/**`、`infra/**`、根配置文件、`README.md`
- 备注：仅骨架占位，未执行 `pnpm install` / `pip install`，未写业务逻辑
