"use client";

import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";

/**
 * antd 主题化：令牌映射 Coach Lab 设计系统（design-preview/coach-lab/coach-lab.css）。
 * AntdRegistry 负责 App Router 下的 SSR 样式抽取，避免首屏闪烁。
 */
const coachLabToken = {
  colorPrimary: "#1e5aa8",
  colorInfo: "#1e5aa8",
  colorText: "#1f2937",
  colorTextSecondary: "#5b6470",
  colorTextTertiary: "#8a93a0",
  colorBorder: "#cdd4dd",
  colorBorderSecondary: "#e2e6eb",
  colorBgContainer: "#ffffff",
  colorBgElevated: "#ffffff",
  borderRadius: 7,
  controlHeight: 36,
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "HarmonyOS Sans", "Microsoft YaHei", sans-serif',
  fontSize: 13
};

export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          cssVar: { key: "cm" },
          token: coachLabToken,
          algorithm: theme.defaultAlgorithm
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
