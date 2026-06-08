# CornerMan 工作日志

记录每次大型修改。新记录追加在最上方（倒序）。
每条字段：日期 / 范围 / 改动摘要 / 影响文件 / 备注。

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
