/**
 * @cornerman/api-client · 前端 API SDK（占位）
 *
 * 后续封装 auth / sessions / videos / reports / revisions / problem-threads / metrics 等调用，
 * 复用 @cornerman/shared-types 的实体与 DTO。
 */

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | undefined;
}

export function createApiClient(options: ApiClientOptions) {
  // 占位实现：后续接入 fetch 封装、错误处理、刷新 token 等。
  return {
    baseUrl: options.baseUrl
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
