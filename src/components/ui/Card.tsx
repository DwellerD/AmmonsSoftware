import { cn } from "@/lib/cn";

/**
 * Card is a simple white surface with a subtle border and shadow.
 * Use it to group related content (a project, a stat, a form, etc.).
 */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ink-200 bg-surface shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Optional padded header area for a Card. */
export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-ink-100 px-5 py-4", className)}
      {...props}
    />
  );
}

/** Card title text. */
export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-ink-900", className)}
      {...props}
    />
  );
}

/** Padded body area for a Card. */
export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
