type CountBadgeProps = {
  count: number;
};

export function CountBadge({ count }: CountBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      aria-label={`${count} việc cần xử lý`}
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white"
    >
      {label}
    </span>
  );
}
