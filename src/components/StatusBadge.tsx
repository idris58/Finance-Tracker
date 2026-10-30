import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getLoanStatusColor } from "@/lib/loans";

interface StatusBadgeProps {
  status?: "open" | "partial" | "settled" | string | null;
  className?: string;
  children?: ReactNode;
  fallbackLabel?: string;
}

export function StatusBadge({
  status,
  className,
  children,
  fallbackLabel,
}: StatusBadgeProps) {
  const colorClass = getLoanStatusColor(status);
  const defaultLabel =
    status === "settled"
      ? "Settled"
      : status === "partial"
        ? "Partial"
        : fallbackLabel || "Unsettled";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        colorClass,
        className
      )}
    >
      {children || defaultLabel}
    </span>
  );
}

