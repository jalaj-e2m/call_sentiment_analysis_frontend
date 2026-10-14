"use client";

import { Crosshair, Eraser, PenLine, Square, X, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type AnnotateTool = "off" | "pen" | "box" | "laser";
type Point = [number, number];
type Shape = { kind: "pen"; points: Point[] } | { kind: "box"; from: Point; to: Point };

/** Other components switch tools with window.dispatchEvent(new CustomEvent(ANNOTATE_EVENT, { detail: tool })). */
export const ANNOTATE_EVENT = "annotate";

const INK = "#ef4444";
const KEYS: Record<string, AnnotateTool> = { KeyD: "pen", KeyB: "box", KeyL: "laser" };
const TOOLS: { tool: AnnotateTool; icon: LucideIcon; label: string; key: string }[] = [
  { tool: "pen", icon: PenLine, label: "Pen", key: "D" },
  { tool: "box", icon: Square, label: "Box", key: "B" },
  { tool: "laser", icon: Crosshair, label: "Laser", key: "L" },
];

function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function draw(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (shape.kind === "pen") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    shape.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    return;
  }
  const x = Math.min(shape.from[0], shape.to[0]);
  const y = Math.min(shape.from[1], shape.to[1]);
  const w = Math.abs(shape.to[0] - shape.from[0]);
  const h = Math.abs(shape.to[1] - shape.from[1]);
  ctx.lineWidth = 3;
  ctx.fillStyle = "rgb(239 68 68 / 0.08)";
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 10);
  ctx.fill();
  ctx.stroke();
}

/**
 * Presenter overlay: draw freehand (D), draw boxes (B) or show a laser pointer (L); C clears,
 * Esc stops. With requireAlt the shortcuts need Alt/Option so they never fire during normal use.
 * Drawings are cleared when the page or resetKey changes.
 */
export function Annotator({ requireAlt = false, resetKey = "" }: { requireAlt?: boolean; resetKey?: string }) {
  const pathname = usePathname();
  const [tool, setTool] = useState<AnnotateTool>("off");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [laser, setLaser] = useState<Point | null>(null);
  const [seen, setSeen] = useState(`${pathname}|${resetKey}`);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Shape | null>(null);

  if (seen !== `${pathname}|${resetKey}`) {
    setSeen(`${pathname}|${resetKey}`);
    setShapes([]);
  }

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of shapes) draw(ctx, s);
    if (draft.current) draw(ctx, draft.current);
  }, [shapes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      redraw();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [redraw]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (typingIn(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === "Escape" && tool !== "off") {
        setTool("off");
        e.preventDefault();
        return;
      }
      if (requireAlt !== e.altKey) return;
      const next = KEYS[e.code];
      if (next) setTool((t) => (t === next ? "off" : next));
      else if (e.code === "KeyC") setShapes([]);
      else return;
      e.preventDefault();
    }
    function onCommand(e: Event) {
      const next = (e as CustomEvent<AnnotateTool | "clear">).detail;
      if (next === "clear") setShapes([]);
      else setTool((t) => (t === next ? "off" : next));
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(ANNOTATE_EVENT, onCommand);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(ANNOTATE_EVENT, onCommand);
    };
  }, [tool, requireAlt]);

  useEffect(() => {
    if (tool !== "laser") return;
    const move = (e: PointerEvent) => setLaser([e.clientX, e.clientY]);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      setLaser(null);
    };
  }, [tool]);

  const drawing = tool === "pen" || tool === "box";
  const at = (e: React.PointerEvent): Point => [e.clientX, e.clientY];

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`fixed inset-0 z-[60] h-screen w-screen ${drawing ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
        onPointerDown={(e) => {
          if (!drawing) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Synthetic or already-released pointers cannot be captured; drawing still works.
          }
          draft.current = tool === "pen" ? { kind: "pen", points: [at(e)] } : { kind: "box", from: at(e), to: at(e) };
        }}
        onPointerMove={(e) => {
          const d = draft.current;
          if (!d) return;
          if (d.kind === "pen") d.points.push(at(e));
          else d.to = at(e);
          redraw();
        }}
        onPointerUp={() => {
          const d = draft.current;
          draft.current = null;
          if (d) setShapes((s) => [...s, d]);
        }}
      />

      {laser ? (
        <>
          <style>{"*{cursor:none !important}"}</style>
          <span
            aria-hidden
            className="pointer-events-none fixed z-[61] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_0_6px_rgb(239_68_68/0.25),0_0_24px_8px_rgb(239_68_68/0.45)]"
            style={{ left: laser[0], top: laser[1] }}
          />
        </>
      ) : null}

      {tool !== "off" ? (
        <div
          role="toolbar"
          aria-label="Presenter tools"
          className="fixed left-1/2 top-3 z-[62] flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-200 bg-white/95 p-1 text-xs shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95"
        >
          {TOOLS.map(({ tool: t, icon: Icon, label, key }) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              aria-pressed={tool === t}
              title={`${label} (${requireAlt ? "Alt+" : ""}${key})`}
              className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-medium ${
                tool === t ? "bg-red-500 text-white" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShapes([])}
            title={`Clear (${requireAlt ? "Alt+" : ""}C)`}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
          <button
            type="button"
            onClick={() => setTool("off")}
            title="Stop (Esc)"
            aria-label="Stop presenter tools"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}
