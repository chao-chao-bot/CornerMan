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
