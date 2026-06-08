import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TrainingSessionsModule } from "./training-sessions/training-sessions.module";
import { VideosModule } from "./videos/videos.module";
import { ReportsModule } from "./reports/reports.module";
import { RevisionsModule } from "./revisions/revisions.module";
import { ScoringModule } from "./scoring/scoring.module";
import { ProblemThreadsModule } from "./problem-threads/problem-threads.module";
import { MetricsModule } from "./metrics/metrics.module";
import { ExportModule } from "./export/export.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    TrainingSessionsModule,
    VideosModule,
    ReportsModule,
    RevisionsModule,
    ScoringModule,
    ProblemThreadsModule,
    MetricsModule,
    ExportModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
