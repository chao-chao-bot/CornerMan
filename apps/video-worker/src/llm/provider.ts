import type { ReportDraftInput, ReportDraftOutput } from "@cornerman/shared-types";

export interface LLMProvider {
  /** 标识用了哪个 provider/模型，写入 AnalysisReport.modelVersion */
  readonly name: string;
  draftReport(input: ReportDraftInput): Promise<ReportDraftOutput>;
}
