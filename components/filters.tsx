"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, X } from "lucide-react";

/**
 * Filter chip with a popover checklist (replaces native selects). Empty selection = no filter.
 * Shows the chosen values in the chip so the active filter is readable without opening it.
 */
export function FilterChip({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const active = selected.length > 0;
  const names = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const summary = names.length === 0 ? null : names.length === 1 ? names[0] : `${names.length} selected`;
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <span className="inline-flex items-center">
      <Popover.Root>
        <Popover.Trigger
          className={`inline-flex h-8 items-center gap-1.5 border px-2.5 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
            active
              ? "rounded-l-md border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "rounded-md border-dashed border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {label}
          {summary ? <span className="max-w-32 truncate font-normal opacity-90">: {summary}</span> : null}
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 max-h-80 w-56 overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div role="group" aria-label={label}>
              {options.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-600"
                      }`}
                      aria-hidden
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })}
            </div>
            {active ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 w-full rounded border-t border-zinc-100 px-2 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Clear filter
              </button>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {active ? (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label={`Clear ${label} filter`}
          className="inline-flex h-8 items-center rounded-r-md border border-l-0 border-zinc-900 bg-zinc-900 px-1.5 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

/** On/off chip, e.g. "Manual-only". */
export function ToggleChip({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
        pressed
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-dashed border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {pressed ? <Check className="h-3 w-3" aria-hidden /> : null}
      {label}
    </button>
  );
}
