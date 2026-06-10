import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type {
  AnalysisReportItem,
  SessionReportDTO
} from "@cornerman/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "../reports/reports.service";
import { CreateRevisionDto } from "./dto/create-revision.dto";

@Injectable()
export class RevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService
  ) {}

  /**
   * 对报告逐条修订。只允许操作 final；若该 session 尚无 final 则自动先 finalize。
   * 永不覆盖 AI 原文：每次修订都把 draft 同 key 的原文快照写入 ReportRevision.aiOriginal。
   */
  async createRevision(
    userId: string,
    reportId: string,
    dto: CreateRevisionDto
  ): Promise<SessionReportDTO> {
    const report = await this.prisma.analysisReport.findFirst({
      where: { id: reportId, deletedAt: null }
    });
    if (!report) throw new NotFoundException("报告不存在");
    await this.reports.assertSessionOwner(userId, report.sessionId);

    // 统一在 final 上操作
    const final = await this.reports.finalize(userId, report.sessionId);

    const draft = await this.prisma.analysisReport.findFirst({
      where: { sessionId: report.sessionId, status: "draft", deletedAt: null }
    });
    const draftItems =
      (draft?.items as unknown as AnalysisReportItem[]) ?? [];
    const aiOriginalItem = draftItems.find((it) => it.key === dto.itemKey);
    const aiOriginal = aiOriginalItem
      ? JSON.stringify(aiOriginalItem)
      : undefined;

    const items = [...((final.items as unknown as AnalysisReportItem[]) ?? [])];
    let userResult: string | undefined;
    let finalItemKey = dto.itemKey;

    switch (dto.action) {
      case "accept": {
        // 仅记录采纳，不改 items
        break;
      }
      case "edit": {
        const idx = items.findIndex((it) => it.key === dto.itemKey);
        if (idx < 0) throw new BadRequestException("待修改的条目不存在");
        const updated: AnalysisReportItem = {
          ...items[idx],
          title: dto.title ?? items[idx].title,
          detail: dto.detail ?? items[idx].detail,
          dimension: dto.dimension ?? items[idx].dimension,
          problemCode: dto.problemCode ?? items[idx].problemCode,
          segmentId: dto.segmentId ?? items[idx].segmentId
        };
        items[idx] = updated;
        userResult = JSON.stringify(updated);
        break;
      }
      case "delete": {
        const idx = items.findIndex((it) => it.key === dto.itemKey);
        if (idx < 0) throw new BadRequestException("待删除的条目不存在");
        items.splice(idx, 1);
        break;
      }
      case "add": {
        if (!dto.dimension) {
          throw new BadRequestException("新增条目需指定 dimension");
        }
        if (!dto.title && !dto.detail) {
          throw new BadRequestException("新增条目需填写内容");
        }
        const newItem: AnalysisReportItem = {
          key: `user-${randomUUID()}`,
          dimension: dto.dimension,
          title: dto.title ?? "",
          detail: dto.detail ?? "",
          problemCode: dto.problemCode,
          segmentId: dto.segmentId
        };
        items.push(newItem);
        finalItemKey = newItem.key;
        userResult = JSON.stringify(newItem);
        break;
      }
      default:
        throw new BadRequestException("未知的修订动作");
    }

    await this.prisma.$transaction([
      this.prisma.analysisReport.update({
        where: { id: final.id },
        data: { items: items as unknown as object }
      }),
      this.prisma.reportRevision.create({
        data: {
          reportId: final.id,
          itemKey: finalItemKey,
          action: dto.action,
          aiOriginal,
          userResult
        }
      })
    ]);

    return this.reports.getSessionReport(userId, report.sessionId);
  }
}
