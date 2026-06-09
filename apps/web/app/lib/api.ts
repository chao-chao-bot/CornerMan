import { createApiClient } from "@cornerman/api-client";
import { getAccessToken } from "./auth";

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export const api = createApiClient({
  baseUrl,
  getAccessToken
});
