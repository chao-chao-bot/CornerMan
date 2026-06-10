import type { ReactNode } from "react";
import { cn } from "./cn";

export interface StatStripProps {
  className?: string;
  children: ReactNode;
}

/** Coach Lab `.stat-strip`：四列统计条（窄屏两列） */
export function StatStrip({ className, children }: StatStripProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export type StatTone = "default" | "blue" | "green";

const STAT_TONE: Record<StatTone, string> = {
  default: "text-ink",
  blue: "text-brand",
  green: "text-improved"
};

export interface StatBoxProps {
  value: ReactNode;
  label: ReactNode;
  tone?: StatTone;
}

/** Coach Lab `.stat-box` */
export function StatBox({ value, label, tone = "default" }: StatBoxProps) {
  return (
    <div className="rounded-sm border border-line bg-surface-2 px-3.5 py-2.5">
      <div className={cn("text-[20px] font-bold", STAT_TONE[tone])}>{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-3">{label}</div>
    </div>
  );
}
