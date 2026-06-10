import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegControlProps<T extends string> {
  value: T;
  options: SegOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** Coach Lab `.seg-control`：分段切换/筛选 */
export function SegControl<T extends string>({
  value,
  options,
  onChange,
  className
}: SegControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-sm border border-line-strong",
        className
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "border-r border-line px-4 py-2 text-[13px] last:border-r-0",
            value === o.value
              ? "bg-brand-soft font-semibold text-brand"
              : "bg-surface text-ink-2 hover:bg-surface-2"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
