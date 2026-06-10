import { DeepSeekProvider } from "./deepseek-provider.js";
import type { LLMProvider } from "./provider.js";
import { StubProvider } from "./stub-provider.js";

export type { LLMProvider } from "./provider.js";
export { StubProvider } from "./stub-provider.js";
export { DeepSeekProvider } from "./deepseek-provider.js";

/**
 * 工厂：有 DEEPSEEK_API_KEY 用 DeepSeek，否则降级 stub。
 * 真正的「调用失败兜底回退 stub」在 analyze.ts 中处理（catch 后用 stub 再跑一次）。
 */
export function createLLMProvider(): LLMProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (apiKey) {
    const provider = new DeepSeekProvider({
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL,
      model: process.env.DEEPSEEK_MODEL
    });
    console.log(`[ai-worker] LLM provider = ${provider.name}`);
    return provider;
  }
  const stub = new StubProvider();
  console.log(`[ai-worker] LLM provider = ${stub.name}（未配置 DEEPSEEK_API_KEY）`);
  return stub;
}
