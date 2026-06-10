import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AntdProvider } from "./components/antd-provider";

export const metadata: Metadata = {
  title: "CornerMan 拳角",
  description: "拳击训练后的 AI 复盘平台"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
