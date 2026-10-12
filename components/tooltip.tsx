"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
      {children}
    </Tooltip.Provider>
  );
}

/** Hover and focus tooltip. The child must be focusable (link or button) so keyboard users get it too. */
export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-xs rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs leading-relaxed text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          {content}
          <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
