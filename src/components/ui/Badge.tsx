import { STATUS_STYLES } from "@/lib/constants";
import type { TradePhaseStatus } from "@/lib/database.types";
import { cn } from "@/lib/cn";

/** A colored pill that displays a trade phase status. */
export function StatusBadge({
  status,
  className,
}: {
  status: TradePhaseStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-ink-100 text-ink-700",
        className,
      )}
    >
      {status}
    </span>
  );
}

/** A neutral, generic badge for small bits of metadata. */
export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700",
        className,
      )}
      {...props}
    />
  );
}
