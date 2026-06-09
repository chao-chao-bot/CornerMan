"use client";

import { cn } from "./cn";

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-sm border border-line-strong",
        className
      )}
    >
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "px-4 py-2 text-[13px] transition-colors",
            i > 0 && "border-l border-line",
            value === item.key
              ? "bg-brand-soft font-semibold text-brand"
              : "bg-surface text-ink-2 hover:text-ink"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
