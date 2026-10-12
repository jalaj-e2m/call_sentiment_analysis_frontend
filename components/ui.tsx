import { ArrowDown, ArrowUp, ChevronRight, CircleCheck, CircleX, Info, Minus, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Sticky page header: breadcrumbs (detail pages), title, subtitle, and controls on the right
 * (date range, actions). Bleeds to the content edges so it reads as a bar while scrolling.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-zinc-200/80 bg-zinc-50/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/75 md:top-0 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 dark:border-zinc-800 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/75">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {breadcrumbs?.length ? (
            <nav aria-label="Breadcrumb" className="mb-0.5">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                {breadcrumbs.map((c, i) => (
                  <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                    {i > 0 ? <ChevronRight className="h-3 w-3 text-zinc-400" aria-hidden /> : null}
                    {c.href ? (
                      <Link href={c.href} className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current="page">{c.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</h1>
          {subtitle ? <div className="text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
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
    <section className={`${surfaceClass} min-w-0 ${className}`}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** KPI tile. Quiet by default; "alert" and "warning" only when the number is a problem. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  children,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "alert" | "warning";
  /** Footer: delta, sparkline, coverage bar or reasons. */
  children?: ReactNode;
}) {
  const accent = {
    default: "text-zinc-400 dark:text-zinc-500",
    alert: "text-sent-unhappy",
    warning: "text-sent-neutral",
  }[tone];
  const border = {
    default: "",
    alert: "border-l-[3px] border-l-sent-unhappy",
    warning: "border-l-[3px] border-l-sent-neutral",
  }[tone];
  return (
    <div className={`${surfaceClass} ${border} flex min-w-0 flex-col p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${accent}`} aria-hidden />
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
      {children ? <div className="mt-2 min-h-5 text-xs text-zinc-600 dark:text-zinc-400">{children}</div> : null}
    </div>
  );
}

/** "+3 vs previous 30 days" with an arrow; neutral colour because more calls is not good or bad. */
export function Delta({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null) return null;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" aria-hidden />
      <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">{value > 0 ? `+${value}` : value}</span>
      <span>{suffix}</span>
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800 ${className}`} />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 border-b border-zinc-200/80 py-3 dark:border-zinc-800">
        <Skeleton className="mb-1.5 h-5 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <KpiSkeletons />
      <TableSkeleton rows={rows} />
    </div>
  );
}

export function KpiSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[104px] rounded-xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={`${surfaceClass} space-y-2 p-4`}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7" />
      ))}
    </div>
  );
}

/** Compact empty state: one line with an optional icon and a short explanation. */
export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-300 px-4 py-4 dark:border-zinc-700">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden /> : null}
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        {children ? <div className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{children}</div> : null}
      </div>
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
    warning: "border-sent-neutral-line bg-sent-neutral-soft text-sent-neutral-fg",
    error: "border-sent-unhappy-line bg-sent-unhappy-soft text-sent-unhappy-fg",
    success: "border-sent-happy-line bg-sent-happy-soft text-sent-happy-fg",
  };
  const Icon = { info: Info, warning: TriangleAlert, error: CircleX, success: CircleCheck }[tone];
  return (
    <div
      role={tone === "info" || tone === "success" ? "note" : "alert"}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Table wrapper. Scrolls horizontally on small screens; with maxHeight it also scrolls vertically
 * so the sticky header row stays visible.
 */
export function TableWrap({ children, minWidth = 720, maxHeight }: { children: ReactNode; minWidth?: number; maxHeight?: string }) {
  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export const th =
  "sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 first:pl-4 last:pr-4 " +
  "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400";
export const td = "border-b border-zinc-100 px-3 py-2 align-middle first:pl-4 last:pr-4 dark:border-zinc-800/70";
export const rowClass = "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 [&:last-child>td]:border-b-0";
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
  "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm placeholder:text-zinc-500 " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900";
