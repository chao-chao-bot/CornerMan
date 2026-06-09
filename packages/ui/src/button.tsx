import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "default" | "ghost";
type Size = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand border border-brand text-white font-semibold hover:bg-brand-hover hover:border-brand-hover",
  default:
    "bg-surface border border-line-strong text-ink hover:border-ink-3",
  ghost: "bg-transparent border border-transparent text-ink-2 hover:bg-surface-2"
};

const sizes: Record<Size, string> = {
  md: "px-3.5 py-2 text-[13px]",
  lg: "px-[18px] py-[11px] text-sm"
};

export function Button({
  variant = "default",
  size = "md",
  block = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...props}
    />
  );
}
