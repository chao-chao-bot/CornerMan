"use client";

import { HigScaffold } from "../components/hig/scaffold";

export default function ProblemsPage() {
  return (
    <HigScaffold title="问题">
      <div className="hig-large-title">
        问题
        <span className="sub">跨训练的问题串联</span>
      </div>
      <div className="hig-empty">
        把反复出现的防守漏洞 / 技术问题跨训练串联追踪，将在后续阶段开放。
      </div>
    </HigScaffold>
  );
}
