import { cn } from "@/lib/cn";

/**
 * PageContainer centers page content and applies consistent horizontal
 * padding and a max width. Use it to wrap the main content of every screen.
 */
export function PageContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6", className)}
      {...props}
    />
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional actions (e.g. a "New" button) shown on the right. */
  action?: React.ReactNode;
}

/** A consistent title row for the top of a page. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
