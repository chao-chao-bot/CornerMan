import type { ReactNode } from "react";
import { cn } from "./cn";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, className, children }: FieldProps) {
  return (
    <div className={cn("mb-4", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12.5px] font-semibold text-ink-2"
      >
        {label}
      </label>
      {children}
      {hint && <div className="mt-1.5 text-[11.5px] text-ink-3">{hint}</div>}
    </div>
  );
}
