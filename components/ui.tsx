import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{eyebrow}</div> : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export const surfaceClass =
  "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-900";

export function Card({
  title,
  description,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No body padding, for tables and lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={`${surfaceClass} ${className}`}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "danger" | "warning";
}) {
  const iconTone = {
    default: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    danger: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    warning: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  }[tone];
  return (
    <div className={`${surfaceClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <span className={`rounded-lg p-1.5 ${iconTone}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800 ${className}`} />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className={`${surfaceClass} space-y-3 p-5`}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      {Icon ? (
        <span className="mb-3 rounded-full bg-zinc-100 p-2.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{children}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    error: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  };
  return (
    <div
      role={tone === "info" || tone === "success" ? "note" : "alert"}
      className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/** Horizontal scroll wrapper so wide tables work on phones. Put it in a flush Card. */
export function TableWrap({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export const th =
  "border-b border-zinc-200 bg-zinc-50/80 px-4 py-2.5 text-xs font-medium text-zinc-500 first:pl-5 last:pr-5 " +
  "dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400";
export const td = "border-b border-zinc-100 px-4 py-3 align-middle first:pl-5 last:pr-5 dark:border-zinc-800/70";
export const rowClass = "transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 [&:last-child>td]:border-b-0";
export const linkClass =
  "font-medium text-zinc-900 underline-offset-4 hover:text-indigo-600 hover:underline dark:text-zinc-100 dark:hover:text-indigo-400";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50";
export const buttonClass =
  `${buttonBase} h-8 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 ` +
  "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
export const smallButtonClass =
  `${buttonBase} h-7 border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 shadow-sm hover:bg-zinc-50 ` +
  "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
export const primaryButtonClass =
  `${buttonBase} h-8 bg-indigo-600 px-3 text-sm text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400`;
export const dangerButtonClass =
  `${buttonBase} h-8 border border-red-200 bg-white px-3 text-sm text-red-700 hover:bg-red-50 ` +
  "dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10";
export const iconButtonClass =
  `${buttonBase} h-8 w-8 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100`;

export const inputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm placeholder:text-zinc-400 " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900";
export const selectClass =
  "h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none " +
  "focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900";
