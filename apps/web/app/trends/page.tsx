"use client";

import { HigScaffold } from "../components/hig/scaffold";

export default function TrendsPage() {
  return (
    <HigScaffold title="趋势">
      <div className="hig-large-title">
        趋势
        <span className="sub">训练量与状态曲线</span>
      </div>
      <div className="hig-empty">
        周 / 月训练量、综合分趋势与实战成败统计将在趋势看板（R6）开放。
      </div>
    </HigScaffold>
  );
}
