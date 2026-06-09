"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Tabs } from "@cornerman/ui";
import { ApiError } from "@cornerman/api-client";
import { api } from "../lib/api";
import { saveAuth } from "../lib/auth";

type Mode = "register" | "login";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("register");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === "register"
          ? await api.register({ email, username, password, displayName })
          : await api.login({ identifier, password });
      saveAuth(res);
      router.push("/sessions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "网络错误，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px] rounded-lg border border-line bg-surface p-7 shadow-sm">
        <div className="flex items-center gap-2.5 text-[18px] font-bold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-extrabold text-white">
            C
          </span>
          CornerMan
        </div>
        <p className="mt-1 text-[13px] text-ink-2">拳击训练后的 AI 复盘教练</p>

        <Tabs
          className="mt-5"
          value={mode}
          onChange={(k) => setMode(k as Mode)}
          items={[
            { key: "register", label: "注册" },
            { key: "login", label: "登录" }
          ]}
        />

        <form className="mt-5" onSubmit={onSubmit}>
          {mode === "login" ? (
            <Field label="邮箱 / 用户名" htmlFor="identifier">
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com 或 用户名"
                autoComplete="username"
              />
            </Field>
          ) : (
            <>
              <Field label="邮箱" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="用户名" htmlFor="username">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3-32 位"
                  autoComplete="username"
                />
              </Field>
              <Field label="昵称（拳手名）" htmlFor="displayName">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="例如：Iron Li"
                />
              </Field>
            </>
          )}
          <Field
            label="密码"
            htmlFor="password"
            hint={mode === "register" ? "至少 8 位，注册成功后直接进入" : undefined}
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </Field>

          {error && (
            <div className="mb-3 rounded-sm border border-risk-line bg-risk-soft px-3 py-2 text-[12.5px] text-risk">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" block disabled={loading}>
            {loading ? "处理中…" : mode === "register" ? "注册并进入" : "登录"}
          </Button>
        </form>
      </div>
    </main>
  );
}
