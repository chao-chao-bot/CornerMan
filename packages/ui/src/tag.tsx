import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TagProps {
  /** type = 钢蓝标签（训练类型等） */
  variant?: "default" | "type";
  className?: string;
  children: ReactNode;
}

/** Coach Lab `.tag` */
export function Tag({ variant = "default", className, children }: TagProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-[5px] border px-2 py-[3px] text-[11px]",
        variant === "type"
          ? "border-brand-line bg-brand-soft text-brand"
          : "border-line-strong bg-surface-2 text-ink-2",
        className
      )}
    >
      {children}
    </span>
  );
}

export type BadgeTone = "still" | "improved" | "new" | "blue";

const BADGE_TONE: Record<BadgeTone, string> = {
  still: "bg-risk-soft text-risk",
  improved: "bg-improved-soft text-improved",
  new: "bg-revise-soft text-revise",
  blue: "bg-brand-soft text-brand"
};

/** Coach Lab `.badge` */
export function Badge({
  tone = "blue",
  className,
  children
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[5px] px-2 py-0.5 text-[10px] font-semibold",
        BADGE_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
