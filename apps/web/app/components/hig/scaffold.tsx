"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "../../lib/auth";
import { useHigTheme } from "./use-hig-theme";
import { TabBar } from "./tab-bar";

interface ScaffoldProps {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** 是否显示底部 Tab Bar（默认显示） */
  tabBar?: boolean;
  /** 关闭登录态守卫（登录页等公共页用不到） */
  guard?: boolean;
  children: ReactNode;
}

/** HIG 页外壳：.hig 作用域 + 系统主题 + 登录态守卫 + 顶部导航 + 可选 Tab Bar */
export function HigScaffold({
  title,
  leading,
  trailing,
  tabBar = true,
  guard = true,
  children
}: ScaffoldProps) {
  const router = useRouter();
  const dark = useHigTheme();
  const [ready, setReady] = useState(!guard);

  useEffect(() => {
    if (!guard) return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [guard, router]);

  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className={`hig-page${tabBar ? " with-tabbar" : ""}`}>
        <div className="hig-nav">
          {leading && <span className="nav-leading">{leading}</span>}
          <span className="nav-title">{title}</span>
          {trailing && <span className="nav-trailing">{trailing}</span>}
        </div>
        {ready ? (
          children
        ) : (
          <div className="hig-loading">加载中…</div>
        )}
      </div>
      {tabBar && <TabBar />}
    </div>
  );
}
