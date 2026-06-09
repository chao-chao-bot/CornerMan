"use client";

import { Card } from "@cornerman/ui";
import { AppFrame } from "../components/app-frame";

export default function ProblemsPage() {
  return (
    <AppFrame>
      <h1 className="mb-[18px] text-[22px] font-bold tracking-tight">问题追踪</h1>
      <Card>
        <p className="py-6 text-center text-[13px] text-ink-3">
          跨训练的问题串联（ProblemThread）将在 P4 阶段开放。
        </p>
      </Card>
    </AppFrame>
  );
}
