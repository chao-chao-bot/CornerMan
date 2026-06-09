import type { ReactNode } from "react";
import { cn } from "./cn";

export interface AppShellProps {
  /** 侧边导航内容（由调用方用框架的 Link 组装） */
  nav: ReactNode;
  /** 顶栏右侧（用户名 / 操作） */
  headerRight?: ReactNode;
  children: ReactNode;
}

export function AppShell({ nav, headerRight, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 flex h-[53px] items-center gap-4 border-b border-line bg-surface px-6">
        <div className="flex items-center gap-2.5 text-[18px] font-bold tracking-tight">
          <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md bg-brand text-sm font-extrabold text-white">
            C
          </span>
          CornerMan
          <small className="text-[11px] font-medium tracking-widest text-ink-3">
            拳角
          </small>
        </div>
        <div className="flex-1" />
        {headerRight}
      </header>
      <div className="grid min-h-[calc(100vh-53px)] grid-cols-1 md:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-surface px-4 py-5 md:block">
          {nav}
        </aside>
        <main className="overflow-hidden px-6 py-5">{children}</main>
      </div>
    </div>
  );
}

export interface NavItemProps {
  active?: boolean;
  className?: string;
  children: ReactNode;
}

/** 仅做样式；调用方用 next/link 包裹（asChild 风格） */
export function navItemClass(active?: boolean): string {
  return cn(
    "mb-0.5 flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13.5px] transition-colors",
    active
      ? "bg-brand-soft font-semibold text-brand"
      : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  );
}
