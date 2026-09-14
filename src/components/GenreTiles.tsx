"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate } from "motion/react";
import { useReducedMotion } from "motion/react";

/**
 * Selecting a genre pushes the others out of the way before the films open.
 *
 * This is the first half of the Codrops transition, where the product cards
 * drift apart and fade as the preview takes over; `GenreAperture` is the second
 * half, on the page this navigates to. The demo hard-codes the direction from
 * the index of a four-item grid (`i % 2`, `i < 2`), which only describes a 2x2.
 * There are eleven genres in a grid that reflows from two columns to four, so
 * the direction is taken from the geometry instead: every tile moves along the
 * line from the chosen one to itself, and the chosen one holds its place.
 *
 * The click is intercepted rather than the link replaced, so the href is real:
 * middle-click, cmd-click and "open in new tab" keep working, and if this
 * component never hydrates the link is still a link.
 */

const SPREAD = 0.025; // of the viewport width, as in the original
const OUT = 300; // ms of parting before the route changes

export function GenreTiles({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (leaving) {
      e.preventDefault();
      return;
    }

    const target = e.target as Element | null;
    const link = target?.closest?.("a[data-genre]") as HTMLAnchorElement | null;
    if (!link) return;

    // Anything but a plain left click belongs to the browser.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const href = link.getAttribute("href");
    if (!href) return;

    if (reduce || !root.current) return; // let the link navigate as normal

    e.preventDefault();
    setLeaving(true);

    const tiles = [...root.current.querySelectorAll<HTMLElement>("a[data-genre]")];
    const from = link.getBoundingClientRect();
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    const spread = Math.min(44, Math.max(18, window.innerWidth * SPREAD));

    for (const tile of tiles) {
      if (tile === link) {
        animate(tile, { scale: 1.03 }, { duration: OUT / 1000, ease: [0.65, 0, 0.35, 1] });
        continue;
      }
      const r = tile.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx;
      const dy = r.top + r.height / 2 - cy;
      // A tile sitting exactly on the chosen one has no direction to take; send
      // it straight up rather than dividing by zero.
      const len = Math.hypot(dx, dy) || 1;
      animate(
        tile,
        { x: (dx / len) * spread, y: (dy / len) * spread, opacity: 0 },
        { duration: OUT / 1000, ease: [0.65, 0, 0.35, 1] },
      );
    }

    window.setTimeout(() => router.push(href), OUT);
  }

  return (
    <div ref={root} onClick={onClick}>
      {children}
    </div>
  );
}
