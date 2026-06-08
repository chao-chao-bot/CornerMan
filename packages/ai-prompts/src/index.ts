/**
 * @cornerman/ai-prompts · LLM prompt 模板（占位）
 *
 * 以版本号管理 prompt，便于 A/B 与回溯。报告生成走「AI 起草 + 用户定稿」模式，
 * 由 ai-service 调用通义千问-VL，将姿态分析结构化结果转为自然语言复盘草稿。
 */

export interface PromptTemplate {
  id: string;
  version: string;
  description: string;
  /** 占位模板字符串，后续用结构化输入渲染 */
  template: string;
}

export const REPORT_DRAFT_PROMPT: PromptTemplate = {
  id: "report-draft",
  version: "0.0.1",
  description: "将姿态分析结构化数据转为拳击训练复盘草稿",
  template: "<placeholder>"
};
