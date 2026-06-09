import type { ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps {
  title?: string;
  meta?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({
  title,
  meta,
  className,
  bodyClassName,
  children
}: CardProps) {
  return (
    <section
      className={cn(
        "mb-4 rounded border border-line bg-surface",
        className
      )}
    >
      {(title || meta) && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          {title && (
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">
              {title}
            </span>
          )}
          {meta && <span className="text-xs text-ink-3">{meta}</span>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
