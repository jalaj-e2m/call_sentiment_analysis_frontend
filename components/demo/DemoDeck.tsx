"use client";

import { ChevronLeft, ChevronRight, Maximize, NotebookText, PenLine } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ANNOTATE_EVENT, Annotator } from "@/components/Annotator";
import { iconButtonClass } from "@/components/ui";
import { SLIDES } from "./slides";

const LAST = SLIDES.length - 1;

/** The current slide lives in the URL hash (#1..#n), so a reload or a shared link keeps the place. */
function readSlide(): number {
  const n = Number.parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) ? Math.min(LAST, Math.max(0, n - 1)) : 0;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function DemoDeck() {
  const index = useSyncExternalStore(subscribe, readSlide, () => 0);
  const [notes, setNotes] = useState(false);
  const slide = SLIDES[index]!;

  const go = useCallback((n: number) => {
    window.location.replace(`#${Math.min(LAST, Math.max(0, n)) + 1}`);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) go(index + 1);
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) go(index - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(LAST);
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      else if (e.key.toLowerCase() === "f") void toggleFullscreen();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  return (
    <div className="flex min-h-screen flex-col">
      <Annotator resetKey={slide.id} />
      <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
        <div className="h-full bg-indigo-600 transition-[width] duration-300 dark:bg-indigo-500" style={{ width: `${(index / LAST) * 100}%` }} />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12" aria-live="polite">
        <section key={slide.id} aria-label={`Slide ${index + 1} of ${SLIDES.length}: ${slide.label}`} className="slide-in w-full max-w-6xl">
          {slide.body}
        </section>
      </main>

      {notes ? (
        <aside
          aria-label="Speaker notes"
          className="max-h-[38vh] overflow-y-auto border-t border-zinc-200 bg-white px-6 py-4 sm:px-12 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Say</p>
          <p className="mt-1 max-w-5xl text-lg leading-relaxed">{slide.notes}</p>
        </aside>
      ) : null}

      <footer className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/80 px-4 py-2 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <nav aria-label="Slides" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-current={i === index ? "step" : undefined}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                i === index
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <span className="hidden text-xs tabular-nums text-zinc-500 sm:inline">
          {index + 1} / {SLIDES.length}
        </span>
        <button
          type="button"
          onClick={() => setNotes((v) => !v)}
          aria-pressed={notes}
          title="Speaker notes (N)"
          aria-label="Speaker notes"
          className={`${iconButtonClass} ${notes ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : ""}`}
        >
          <NotebookText className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(ANNOTATE_EVENT, { detail: "pen" }))}
          title="Draw: pen (D), box (B), laser (L), clear (C), stop (Esc)"
          aria-label="Draw on the slide"
          className={iconButtonClass}
        >
          <PenLine className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} title="Full screen (F)" aria-label="Full screen" className={iconButtonClass}>
          <Maximize className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} title="Previous (←)" aria-label="Previous slide" className={iconButtonClass}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={index === LAST} title="Next (→)" aria-label="Next slide" className={iconButtonClass}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </footer>
    </div>
  );
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Some browsers refuse full screen outside a direct click; the keyboard and buttons still work.
  }
}
