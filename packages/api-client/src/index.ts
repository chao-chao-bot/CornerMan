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
  TrainingSessionDTO,
  VideoDTO
} from "@cornerman/shared-types";

export interface ApiClientOptions {
  baseUrl: string;
  /** 返回当前 access token，请求时自动加到 Authorization 头 */
  getAccessToken?: () => string | undefined;
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

  async function request<T>(
    path: string,
    init: { method?: string; body?: unknown; auth?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (init.auth !== false) {
      const token = options.getAccessToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined
    });

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
    // ---- training sessions ----
    createSession: (input: CreateTrainingSessionInput) =>
      request<TrainingSessionDTO>("/training-sessions", {
        method: "POST",
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
