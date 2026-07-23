import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "amber" | "slate" | "pink";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-600/10",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    amber: "bg-amber-50 text-amber-800 ring-amber-600/10",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
    pink: "bg-pink-50 text-pink-700 ring-pink-600/10",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
