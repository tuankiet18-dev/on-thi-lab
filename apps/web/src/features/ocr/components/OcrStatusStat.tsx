import { cn } from "../../../lib/cn";

export function OcrStatusStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn("rounded-lg p-3", className)}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
