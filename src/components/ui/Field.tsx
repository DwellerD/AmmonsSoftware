import { cn } from "@/lib/cn";

/**
 * Form field building blocks: Label, Input, Textarea, Select, and a Field
 * wrapper that ties a label + control + optional error message together.
 *
 * These are deliberately thin wrappers around native HTML elements so they
 * stay predictable and accessible.
 */

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-ink-700", className)}
      {...props}
    />
  );
}

const baseControl =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 " +
  "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none " +
  "focus:ring-2 focus:ring-brand-500/30 disabled:bg-ink-50 disabled:text-ink-400";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseControl, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(baseControl, "min-h-[90px] resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(baseControl, "pr-8", className)} {...props} />;
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  /** Show a small "required" marker next to the label. */
  required?: boolean;
  /** Validation/error message shown below the control. */
  error?: string;
  children: React.ReactNode;
}

/** Wraps a label and form control, with optional required marker and error. */
export function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: FieldProps) {
  return (
    <div>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
