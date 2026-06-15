"use client";

import { useEffect, useState } from "react";

/** 跟随系统浅/深色，返回是否深色，供 .hig 页设置 data-theme */
export function useHigTheme(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

/**
 * 把系统浅/深色同步到 <html data-prefers-color-scheme>，
 * 让 antd-mobile 弹层（Portal 到 body，不在 .hig 子树内）跟随深色。
 * 系统色全局一致，重复写入无副作用。
 */
export function useAdmDarkSync(): void {
  const dark = useHigTheme();
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.setAttribute("data-prefers-color-scheme", "dark");
    else root.removeAttribute("data-prefers-color-scheme");
  }, [dark]);
}
