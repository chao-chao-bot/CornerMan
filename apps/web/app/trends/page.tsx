"use client";

import { Card } from "@cornerman/ui";
import { AppFrame } from "../components/app-frame";

export default function TrendsPage() {
  return (
    <AppFrame>
      <h1 className="mb-[18px] text-[22px] font-bold tracking-tight">趋势</h1>
      <Card>
        <p className="py-6 text-center text-[13px] text-ink-3">
          周 / 月训练量与评分趋势将在 P5 阶段开放。
        </p>
      </Card>
    </AppFrame>
  );
}
