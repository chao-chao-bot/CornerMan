import type { AuthResponse, PublicUser } from "@cornerman/shared-types";

const ACCESS_KEY = "cm.accessToken";
const REFRESH_KEY = "cm.refreshToken";
const USER_KEY = "cm.user";

const hasWindow = () => typeof window !== "undefined";

export function getAccessToken(): string | undefined {
  if (!hasWindow()) return undefined;
  return window.localStorage.getItem(ACCESS_KEY) ?? undefined;
}

export function getRefreshToken(): string | undefined {
  if (!hasWindow()) return undefined;
  return window.localStorage.getItem(REFRESH_KEY) ?? undefined;
}

export function getStoredUser(): PublicUser | undefined {
  if (!hasWindow()) return undefined;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    return undefined;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export function saveAuth(res: AuthResponse): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(ACCESS_KEY, res.tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, res.tokens.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
}

export function clearAuth(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}
