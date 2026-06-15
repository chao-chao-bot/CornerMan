"use client";

import { SpinLoading } from "antd-mobile";
import { useHigTheme } from "./use-hig-theme";

/** HIG 风格加载占位：iOS 活动指示器 + 文案。放在已有 .hig 作用域内使用。 */
export function HigLoading({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="hig-loading" role="status" aria-live="polite">
      <SpinLoading className="hig-spin" />
      <span>{text}</span>
    </div>
  );
}

/** 带 .hig/.hig-page 外壳的整页加载占位：用于详情 / 编辑等独立路由的初始加载。 */
export function HigLoadingPage({ text }: { text?: string }) {
  const dark = useHigTheme();
  return (
    <div className="hig" data-theme={dark ? "dark" : "light"}>
      <div className="hig-page">
        <HigLoading text={text} />
      </div>
    </div>
  );
}
