import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] text-ink transition-colors placeholder:text-ink-3 focus:outline-none focus:border-brand";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-16 resize-y", className)}
      {...props}
    />
  );
}
