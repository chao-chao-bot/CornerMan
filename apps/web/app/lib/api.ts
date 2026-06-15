import { createApiClient } from "@cornerman/api-client";
import { clearAuth, getAccessToken, getRefreshToken, saveAuth } from "./auth";

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export const api = createApiClient({
  baseUrl,
  getAccessToken,
  getRefreshToken,
  onTokensRefreshed: (res) => saveAuth(res),
  onAuthFailed: () => {
    clearAuth();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }
});
