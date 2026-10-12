import { Calendar } from "lucide-react";
import Link from "next/link";
import { RANGE_KEYS, RANGE_LABELS, rangeHref, type RangeKey } from "@/lib/analytics";

const SHORT: Record<RangeKey, string> = { "7": "7d", "30": "30d", "90": "90d", all: "All" };

const segmentGroup =
  "inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white p-0.5 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900";
const segmentItem =
  "inline-flex h-full items-center rounded px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50";
const segmentOn = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
const segmentOff = "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

/** Date range for every chart and KPI on the page; lives in the URL (?range=7|30|90|all). */
export function RangeControl({ range, path }: { range: RangeKey; path: string }) {
  return (
    <nav aria-label="Date range" className="flex items-center gap-2">
      <Calendar className="hidden h-4 w-4 text-zinc-500 sm:block" aria-hidden />
      <div className={segmentGroup}>
        {RANGE_KEYS.map((key) => (
          <Link
            key={key}
            href={rangeHref(path, key)}
            scroll={false}
            aria-current={key === range ? "true" : undefined}
            aria-label={RANGE_LABELS[key]}
            className={`${segmentItem} ${key === range ? segmentOn : segmentOff}`}
          >
            {SHORT[key]}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Single-choice segmented control (radio group semantics). Use from client components. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={segmentGroup}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`${segmentItem} ${o.value === value ? segmentOn : segmentOff}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
