# CornerMan 工作日志

记录每次大型修改。新记录追加在最上方（倒序）。
每条字段：日期 / 范围 / 改动摘要 / 影响文件 / 备注。

## 2026-06-09 · P1 账号 + 训练记录纵切（首条端到端链路）
- 范围：api / packages / web / infra / 文档
- 改动摘要：
  - **api**：新增全局 `PrismaModule`/`PrismaService`；执行 `prisma migrate dev --name init` 落表（`User`/`TrainingSession`）
  - **api · auth**：`UsersService`（bcrypt）、`AuthService`（register/login/refresh/me，access 15min + refresh 30d）、自定义 `JwtAuthGuard` + `@CurrentUser` 装饰器、`RegisterDto`/`LoginDto`/`RefreshDto`
  - **api · training-sessions**：`create`/`list`/`detail`，受 `JwtAuthGuard` 守卫，userId 取自 token；`main.ts` 启用 CORS
  - **packages/shared-types**：补 auth/training DTO 与响应类型；改为构建到 `dist`（导出 `.d.ts`），api/api-client 经 `dist` 解析以绕过跨包 rootDir 限制
  - **packages/api-client**：实现 fetch 封装（自动 `Authorization: Bearer` + 结构化 `ApiError`），覆盖 auth 与 sessions
  - **packages/ui**：迁移 Coach Lab 基础组件 `Button/Input/Textarea/Field/Card/Tabs/AppShell` + `cn`/`navItemClass`
  - **web**：鉴权 store（localStorage）+ api 实例、登录/注册页、训练列表/新建/详情页、客户端路由守卫 `AppFrame`；`trends`/`problems` 占位页接入框架
  - **infra**：本机 5432 被既有 `postgresql@14` 占用，容器 Postgres 宿主机端口改 **5433**（`docker-compose.yml` + `.env`/`.env.example`）
- 影响文件：`apps/api/src/{prisma,users,auth,training-sessions}/**`、`apps/api/src/{main,app.module}.ts`、`apps/api/.env`、`packages/{shared-types,api-client,ui}/**`、`apps/web/app/**`、`apps/web/.env.local`、`.env`、`infra/docker-compose.yml`、`infra/.env.example`、`docs/roadmap.md`
- 验证：curl 跑通 register→me→创建/列出 session、未授权返 401；浏览器冒烟（注册→新建训练→列表可见）通过；`tsc --noEmit` 全绿（api/web/ui/api-client/shared-types）
- 备注：refresh 仅基础实现（暂无黑名单/轮换）；未做视频/AI/片段/趋势（P2+）

## 2026-06-09 · 新增执行路线图
- 范围：项目文档
- 改动摘要：
  - 新增 `docs/roadmap.md`：P0-P5 分阶段纵切交付，每阶段含任务清单与退出标准；附设计原则、横切关注点、依赖关系 mermaid 图、风险登记、上线准入清单
  - `README.md` 文档索引新增"执行路线图"一行
- 影响文件：`docs/roadmap.md`、`README.md`
- 备注：仅文档，未写业务代码；当前进度 P0 完成、P1 待启动

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
