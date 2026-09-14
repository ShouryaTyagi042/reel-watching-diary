"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, useReducedMotion } from "motion/react";

/**
 * Choosing a film expands its poster and clears the rest out of the way.
 *
 * This is the first half of the Codrops transition, where the product cards
 * drift apart and fade as the preview takes over; `Aperture` is the second half,
 * on the page this navigates to. The chosen poster grows and travels part of the
 * way to the middle of the screen, so the thing you picked becomes the thing
 * that opens rather than simply vanishing.
 *
 * The demo hard-codes direction from the index of a four-item grid (`i % 2`,
 * `i < 2`), which only describes a 2x2. A library page is a reflowing grid of up
 * to twenty-four posters, so direction is taken from the geometry instead: every
 * other tile moves along the line from the chosen one to itself.
 *
 * The click is intercepted rather than the link replaced, so the href is real:
 * middle-click, cmd-click and "open in new tab" keep working, and if this
 * component never hydrates the posters are still links.
 */

const SPREAD = 0.025; // of the viewport width, as in the original
const PULL = 0.45; // how far the chosen poster travels towards the middle
const GROW = 1.3; // how far it expands
const OUT = 340; // ms before the route changes

export function ExpandingGrid({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (leaving) {
      e.preventDefault();
      return;
    }

    const link = (e.target as Element | null)?.closest?.("a[data-tile]") as HTMLAnchorElement | null;
    if (!link) return;

    // Anything but a plain left click belongs to the browser.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const href = link.getAttribute("href");
    if (!href || reduce || !root.current) return;

    e.preventDefault();
    setLeaving(true);

    const tiles = [...root.current.querySelectorAll<HTMLElement>("a[data-tile]")];
    const r = link.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const spread = Math.min(44, Math.max(18, window.innerWidth * SPREAD));
    const timing = { duration: OUT / 1000, ease: [0.65, 0, 0.35, 1] as const };

    // Lift the chosen poster out of the grid's stacking order first, or it
    // expands underneath its neighbours.
    link.style.position = "relative";
    link.style.zIndex = "10";

    animate(
      link,
      {
        scale: GROW,
        x: (window.innerWidth / 2 - cx) * PULL,
        y: (window.innerHeight / 2 - cy) * PULL,
      },
      timing,
    );

    for (const tile of tiles) {
      if (tile === link) continue;
      const t = tile.getBoundingClientRect();
      const dx = t.left + t.width / 2 - cx;
      const dy = t.top + t.height / 2 - cy;
      // A tile sitting exactly on the chosen one has no direction to take; send
      // it straight up rather than dividing by zero.
      const len = Math.hypot(dx, dy) || 1;
      animate(tile, { x: (dx / len) * spread, y: (dy / len) * spread, opacity: 0 }, timing);
    }

    window.setTimeout(() => router.push(href), OUT);
  }

  return (
    <div ref={root} onClick={onClick}>
      {children}
    </div>
  );
}
