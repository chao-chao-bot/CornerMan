"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@cornerman/api-client";
import { api } from "../lib/api";
import { saveAuth } from "../lib/auth";
import { useHigTheme } from "../components/hig/use-hig-theme";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const dark = useHigTheme();
  const [mode, setMode] = useState<Mode>("login");
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
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page" style={{ paddingBottom: 0 }}>
        <div className="hig-auth">
          <div className="hig-brand">
            <span className="mark">C</span>
            CornerMan 拳角
          </div>
          <p className="tagline">拳击训练记录与复盘</p>

          <form className="auth-card" onSubmit={onSubmit}>
            <div style={{ padding: "0 16px" }}>
              <div className="hig-seg" style={{ display: "flex", width: "100%" }}>
                <button
                  type="button"
                  style={{ flex: 1 }}
                  className={mode === "login" ? "on" : ""}
                  onClick={() => setMode("login")}
                >
                  登录
                </button>
                <button
                  type="button"
                  style={{ flex: 1 }}
                  className={mode === "register" ? "on" : ""}
                  onClick={() => setMode("register")}
                >
                  注册
                </button>
              </div>
            </div>

            <div className="hig-form" style={{ marginTop: 14 }}>
              {mode === "login" ? (
                <label className="hig-field">
                  <span className="fl">账号</span>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="邮箱 或 用户名"
                    autoComplete="username"
                  />
                </label>
              ) : (
                <>
                  <label className="hig-field">
                    <span className="fl">邮箱</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>
                  <label className="hig-field">
                    <span className="fl">用户名</span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="3-32 位"
                      autoComplete="username"
                    />
                  </label>
                  <label className="hig-field">
                    <span className="fl">昵称</span>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="拳手名，例如 Iron Li"
                    />
                  </label>
                </>
              )}
              <label className="hig-field">
                <span className="fl">密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                />
              </label>
            </div>

            {error && (
              <p
                style={{
                  color: "var(--red)",
                  fontSize: 13,
                  padding: "10px 32px 0"
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="hig-btn-filled"
              disabled={loading}
            >
              {loading
                ? "处理中…"
                : mode === "register"
                  ? "注册并进入"
                  : "登录"}
            </button>
            <p className="hig-section-footer" style={{ textAlign: "center" }}>
              {mode === "register"
                ? "注册成功后直接进入，无需邮箱验证。"
                : "还没有账号？点上方「注册」。"}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
