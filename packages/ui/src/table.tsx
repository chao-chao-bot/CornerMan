import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TableProps {
  className?: string;
  children: ReactNode;
}

/** Coach Lab `.table`：表头大写细体、行底分隔线、最后一行无边框 */
export function Table({ className, children }: TableProps) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-[13.5px]",
        "[&_th]:border-b [&_th]:border-line [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-ink-3",
        "[&_td]:border-b [&_td]:border-line [&_td]:px-3.5 [&_td]:py-3",
        "[&_tbody_tr:last-child_td]:border-b-0",
        className
      )}
    >
      {children}
    </table>
  );
}
