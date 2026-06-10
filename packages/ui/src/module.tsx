import type { ReactNode } from "react";
import { cn } from "./cn";

export interface ModuleProps {
  /** 模块标题（大写、字距） */
  head?: ReactNode;
  /** 标题右侧元信息 */
  meta?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 不要内边距（视频台等需要贴边内容时） */
  noBodyPadding?: boolean;
  children: ReactNode;
}

/** Coach Lab `.module`：带可选标题栏的内容容器 */
export function Module({
  head,
  meta,
  className,
  bodyClassName,
  noBodyPadding,
  children
}: ModuleProps) {
  return (
    <section
      className={cn(
        "mb-4 rounded border border-line bg-surface",
        className
      )}
    >
      {(head || meta) && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          {head && (
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">
              {head}
            </span>
          )}
          {meta && <span className="text-xs text-ink-3">{meta}</span>}
        </header>
      )}
      <div className={cn(!noBodyPadding && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
