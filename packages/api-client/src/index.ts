/**
 * @cornerman/api-client · 前端 API SDK
 *
 * 轻量 fetch 封装：自动拼接 baseUrl、附带 Bearer token、解析 JSON、抛出结构化错误。
 * 类型复用 @cornerman/shared-types，避免前后端类型漂移。
 */
import type {
  AuthResponse,
  CompleteVideoUploadInput,
  CreateRevisionInput,
  CreateTemplateInput,
  CreateTrainingSessionInput,
  InitVideoUploadInput,
  InitVideoUploadResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
  ReportDTO,
  ScoreDTO,
  SessionListItemDTO,
  SessionReportDTO,
  TemplateDTO,
  TrainingSessionDTO,
  UpdateSessionContentInput,
  UpdateSessionMetaInput,
  UpdateTemplateInput,
  VideoDTO
} from "@cornerman/shared-types";

export interface ApiClientOptions {
  baseUrl: string;
  /** 返回当前 access token，请求时自动加到 Authorization 头 */
  getAccessToken?: () => string | undefined;
  /** 返回当前 refresh token，access token 失效（401）时用于静默续期 */
  getRefreshToken?: () => string | undefined;
  /** 静默续期成功后回调，用于持久化新的 token */
  onTokensRefreshed?: (res: AuthResponse) => void;
  /** 续期失败（refresh token 也失效）时回调，通常用于登出并跳转登录 */
  onAuthFailed?: () => void;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  // 同一时刻只允许一个续期请求，避免多请求并发 401 时重复刷新（token 风暴）
  let refreshInFlight: Promise<string | null> | null = null;

  async function doRefresh(): Promise<string | null> {
    const refreshToken = options.getRefreshToken?.();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      options.onTokensRefreshed?.(data);
      return data.tokens.accessToken;
    } catch {
      return null;
    }
  }

  function refreshOnce(): Promise<string | null> {
    if (!refreshInFlight) {
      refreshInFlight = doRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function request<T>(
    path: string,
    init: { method?: string; body?: unknown; auth?: boolean } = {}
  ): Promise<T> {
    const send = (): Promise<Response> => {
      const headers: Record<string, string> = {};
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (init.auth !== false) {
        const token = options.getAccessToken?.();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      return fetch(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined
      });
    };

    let res = await send();

    // access token 过期：用 refresh token 静默续期后重试一次
    if (
      res.status === 401 &&
      init.auth !== false &&
      options.getRefreshToken?.()
    ) {
      const newToken = await refreshOnce();
      if (newToken) {
        res = await send();
      } else {
        options.onAuthFailed?.();
      }
    }

    if (!res.ok) {
      let message = `请求失败 (${res.status})`;
      try {
        const data = (await res.json()) as { message?: string | string[] };
        if (data?.message) {
          message = Array.isArray(data.message)
            ? data.message.join("；")
            : data.message;
        }
      } catch {
        // 忽略非 JSON 错误体
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    baseUrl,
    // ---- auth ----
    register: (input: RegisterInput) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: input,
        auth: false
      }),
    login: (input: LoginInput) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: input,
        auth: false
      }),
    refresh: (refreshToken: string) =>
      request<AuthResponse>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        auth: false
      }),
    me: () => request<PublicUser>("/auth/me"),
    // ---- templates ----
    listTemplates: () => request<TemplateDTO[]>("/templates"),
    getTemplate: (id: string) => request<TemplateDTO>(`/templates/${id}`),
    createTemplate: (input: CreateTemplateInput) =>
      request<TemplateDTO>("/templates", { method: "POST", body: input }),
    updateTemplate: (id: string, input: UpdateTemplateInput) =>
      request<TemplateDTO>(`/templates/${id}`, {
        method: "PATCH",
        body: input
      }),
    deleteTemplate: (id: string) =>
      request<{ id: string }>(`/templates/${id}`, { method: "DELETE" }),
    duplicateTemplate: (id: string) =>
      request<TemplateDTO>(`/templates/${id}/duplicate`, { method: "POST" }),
    // ---- training sessions ----
    createSession: (input: CreateTrainingSessionInput) =>
      request<TrainingSessionDTO>("/training-sessions", {
        method: "POST",
        body: input
      }),
    updateSessionContent: (id: string, input: UpdateSessionContentInput) =>
      request<TrainingSessionDTO>(`/training-sessions/${id}/content`, {
        method: "PATCH",
        body: input
      }),
    updateSessionMeta: (id: string, input: UpdateSessionMetaInput) =>
      request<TrainingSessionDTO>(`/training-sessions/${id}/meta`, {
        method: "PATCH",
        body: input
      }),
    listSessions: () =>
      request<SessionListItemDTO[]>("/training-sessions"),
    getSession: (id: string) =>
      request<TrainingSessionDTO>(`/training-sessions/${id}`),
    deleteSession: (id: string) =>
      request<{ id: string }>(`/training-sessions/${id}`, {
        method: "DELETE"
      }),
    reanalyzeSession: (id: string) =>
      request<{ id: string; videoCount: number }>(
        `/training-sessions/${id}/reanalyze`,
        { method: "POST" }
      ),
    // ---- videos ----
    initVideoUpload: (sessionId: string, input: InitVideoUploadInput) =>
      request<InitVideoUploadResponse>(
        `/training-sessions/${sessionId}/videos/upload-init`,
        { method: "POST", body: input }
      ),
    completeVideoUpload: (input: CompleteVideoUploadInput) =>
      request<VideoDTO>(`/videos/${input.videoId}/upload-complete`, {
        method: "POST"
      }),
    listSessionVideos: (sessionId: string) =>
      request<VideoDTO[]>(`/training-sessions/${sessionId}/videos`),
    getVideo: (id: string) => request<VideoDTO>(`/videos/${id}`),
    deleteVideo: (id: string) =>
      request<{ id: string }>(`/videos/${id}`, { method: "DELETE" }),
    // ---- reports / revisions / scoring ----
    getSessionReport: (sessionId: string) =>
      request<SessionReportDTO>(`/training-sessions/${sessionId}/report`),
    finalizeReport: (sessionId: string) =>
      request<ReportDTO>(`/training-sessions/${sessionId}/report/finalize`, {
        method: "POST"
      }),
    completeReport: (sessionId: string) =>
      request<ReportDTO>(`/training-sessions/${sessionId}/report/complete`, {
        method: "POST"
      }),
    createRevision: (reportId: string, input: CreateRevisionInput) =>
      request<SessionReportDTO>(`/reports/${reportId}/revisions`, {
        method: "POST",
        body: input
      }),
    updateScore: (sessionId: string, dimension: string, userScore: number) =>
      request<ScoreDTO>(
        `/training-sessions/${sessionId}/scores/${dimension}`,
        { method: "PATCH", body: { userScore } }
      )
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
