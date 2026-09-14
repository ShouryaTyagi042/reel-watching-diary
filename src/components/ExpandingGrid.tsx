"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, useReducedMotion } from "motion/react";

/**
 * Choosing a film expands its poster and clears the page around it.
 *
 * This is the first half of the Codrops transition, where the product cards
 * drift apart and fade as the preview takes over; `Aperture` is the second half,
 * on the page this navigates to.
 *
 * Three things learned from recording it rather than reading frame counts:
 *
 *   The expansion has to outlast the wait. A film's page has no loading state,
 *   so until it is ready the old one is what is on screen, and the first version
 *   of this reached full size and then sat frozen for about a second. The poster
 *   now keeps growing slowly after the initial move, so whenever the swap lands
 *   it lands on something still in motion. A built server answers in about 30ms
 *   and the drift is never seen; a cold dev server takes a second and it is the
 *   whole transition.
 *
 *   The easing has to bite immediately. `cubic-bezier(0.65, 0, 0.35, 1)` is
 *   symmetric, and over 340ms its slow start read as 150ms of nothing followed
 *   by a lurch. Leaving is an exit, so it eases out only.
 */

const SPREAD = 0.025; // of the viewport width, as in the original
const PULL = 0.45; // how far the chosen poster travels towards the middle
const GROW = 1.3; // how far it expands on the initial move
const DRIFT = 1.55; // and how far it keeps going while the film loads
const OUT = 0.38; // seconds for the initial move
const HOLD = 3; // seconds of continued growth, longer than any sane load
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function ExpandingGrid({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (leaving) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const link = (e.target as Element | null)?.closest?.("a[data-tile]") as HTMLAnchorElement | null;
    if (!link) return;

    // Anything but a plain left click belongs to the browser.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const href = link.getAttribute("href");
    if (!href || reduce || !root.current) return;

    /*
     * Capture phase, and stop the event here.
     *
     * `Link` attaches its own click handler to the anchor, which is the target,
     * so on the way back up it runs before anything on this wrapper and calls
     * router.push itself. Preventing the default then is too late: the route had
     * already changed about 110ms in, whatever the timer below said, and the two
     * halves of the transition were never actually in sequence. Taking the click
     * on the way down and stopping it means Link never sees it.
     */
    e.preventDefault();
    e.stopPropagation();
    setLeaving(true);

    const tiles = [...root.current.querySelectorAll<HTMLElement>("a[data-tile]")];
    const r = link.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const spread = Math.min(44, Math.max(18, window.innerWidth * SPREAD));
    const leave = { duration: OUT, ease: EASE };

    // Lift the chosen poster out of the grid's stacking order first, or it
    // expands underneath its neighbours.
    link.style.position = "relative";
    link.style.zIndex = "10";

    const toX = (window.innerWidth / 2 - cx) * PULL;
    const toY = (window.innerHeight / 2 - cy) * PULL;

    // One animation rather than two chained, so there is no seam between the
    // move and the drift: 12% of the timeline covers the move, the rest creeps.
    animate(
      link,
      { scale: [1, GROW, DRIFT], x: [0, toX, toX * 1.1], y: [0, toY, toY * 1.1] },
      { duration: OUT + HOLD, times: [0, OUT / (OUT + HOLD), 1], ease: EASE },
    );

    for (const tile of tiles) {
      if (tile === link) continue;
      const t = tile.getBoundingClientRect();
      const dx = t.left + t.width / 2 - cx;
      const dy = t.top + t.height / 2 - cy;
      // A tile sitting exactly on the chosen one has no direction to take; send
      // it straight up rather than dividing by zero.
      const len = Math.hypot(dx, dy) || 1;
      animate(tile, { x: (dx / len) * spread, y: (dy / len) * spread, opacity: 0 }, leave);
    }

    // The heading, the filters and the pager are still the old page. Leaving
    // them at full strength made the screen look half dead rather than in
    // transit.
    for (const el of document.querySelectorAll<HTMLElement>("[data-fade]")) {
      animate(el, { opacity: 0 }, leave);
    }

    /*
     * Hand over once the poster has moved, not on the click.
     *
     * Built it the other way round first, since pushing immediately obviously
     * removes a delay. It does, but a built server answers a film in about
     * 30ms, so the page swapped before the expansion had travelled far enough
     * to read and the whole gesture was lost. The wait is what makes it legible;
     * the drift above is what covers a wait longer than this one.
     */
    window.setTimeout(() => router.push(href), OUT * 1000);
  }

  return (
    <div ref={root} onClickCapture={onClick}>
      {children}
    </div>
  );
}
