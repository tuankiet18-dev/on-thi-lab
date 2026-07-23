import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-strong active:bg-primary-strong",
  secondary:
    "border border-border-strong bg-white text-foreground shadow-sm hover:border-primary/40 hover:bg-primary-soft",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-foreground",
  danger: "bg-danger text-white shadow-sm hover:bg-red-700",
};

export function Button({
  className,
  variant = "primary",
  icon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
