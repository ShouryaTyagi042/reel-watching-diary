"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, useReducedMotion } from "motion/react";

/**
 * Choosing a film carries its poster up to the corner, and the details follow.
 *
 * The poster is the one thing both pages have, so it is the thing that moves:
 * it leaves the grid, travels to where the film page keeps it, and the rest of
 * that page arrives around it. Nothing is revealed or wiped; the artwork simply
 * goes where it is going.
 *
 * It survives the route change by being a copy. The real tile belongs to the
 * library page and is destroyed when that page unmounts, so what flies is a
 * plain div on `document.body`, outside React's tree, carrying the poster as a
 * background image. When the film page has drawn its own poster the copy lands
 * exactly on it and fades, which is why the join cannot be seen: both are the
 * same picture at the same size.
 *
 * The click is taken on the way down and stopped there. `Link` puts its own
 * handler on the anchor, and since the anchor is the target that handler runs
 * before anything here and navigates on its own, which would cut the flight off
 * a hundred milliseconds in.
 */

/*
 * Seconds for the poster to reach the corner, and so how long the film page is
 * waited for. Eased out, it is visibly there well before this elapses, and at
 * 0.55 that left it sitting alone on a black page for a beat before the details
 * arrived. The flight still reads at 0.42 and the hold mostly goes.
 */
const TRAVEL = 0.42;
const LAND = 0.24; // and to settle onto the real one once it exists
const FADE = 0.18;
const SPREAD = 0.02; // how far the rest of the grid drifts as it goes
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Where the film page keeps its poster, worked out from the same numbers that
 * page lays itself out with. It only has to be close: once the real poster
 * exists the copy corrects onto it.
 */
function corner(): { left: number; top: number; width: number } {
  const vw = window.innerWidth;
  const pad = vw >= 1024 ? 40 : vw >= 640 ? 24 : 16;
  const left = Math.max(pad, (vw - 1440) / 2 + pad);
  const width = vw >= 1024 ? 260 : vw >= 640 ? 200 : 160;
  const header = document.querySelector("header")?.getBoundingClientRect().height ?? 68;
  // The back link and the header's own top margin sit between them.
  return { left, top: header + 74, width };
}

export function PosterFlight({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const inFlight = useRef<HTMLElement | null>(null);

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
    const img = link.querySelector("img");
    if (!href || !img || reduce || !root.current) return;

    e.preventDefault();
    e.stopPropagation();
    setLeaving(true);

    const from = img.getBoundingClientRect();
    const copy = document.createElement("div");
    Object.assign(copy.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      transformOrigin: "top left",
      backgroundImage: `url("${img.currentSrc || img.src}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      zIndex: "60",
      pointerEvents: "none",
    });
    document.body.appendChild(copy);
    inFlight.current = copy;

    /*
     * The copy outlives this component on purpose.
     *
     * Navigating unmounts the library page, so anything torn down with it is
     * torn down at the exact moment the flight matters. An earlier version
     * dropped the copy in an effect cleanup and it vanished on the route change;
     * that looked right only because the film page happens to put its poster in
     * the same place, and any difference would have shown as a jump. So the copy
     * owns its own ending: it lands, or it goes back, or it times out.
     */
    let alive = true;
    const discard = () => {
      if (!alive) return;
      alive = false;
      window.removeEventListener("popstate", discard);
      copy.remove();
      if (inFlight.current === copy) inFlight.current = null;
    };
    window.addEventListener("popstate", discard);

    const to = corner();
    animate(
      copy,
      { x: to.left - from.left, y: to.top - from.top, scale: to.width / from.width },
      { duration: TRAVEL, ease: EASE },
    );

    // The tile itself goes with the rest of the grid; the copy is what is seen.
    const leave = { duration: TRAVEL * 0.55, ease: EASE };
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    const spread = Math.min(36, Math.max(14, window.innerWidth * SPREAD));

    for (const tile of root.current.querySelectorAll<HTMLElement>("a[data-tile]")) {
      const t = tile.getBoundingClientRect();
      const dx = t.left + t.width / 2 - cx;
      const dy = t.top + t.height / 2 - cy;
      // The chosen tile has no direction to take and is covered anyway.
      const len = Math.hypot(dx, dy) || 1;
      animate(
        tile,
        tile === link
          ? { opacity: 0 }
          : { x: (dx / len) * spread, y: (dy / len) * spread, opacity: 0 },
        leave,
      );
    }

    // The heading, the filters and the pager are still the old page.
    for (const el of document.querySelectorAll<HTMLElement>("[data-fade]")) {
      animate(el, { opacity: 0 }, leave);
    }

    window.setTimeout(() => router.push(href), TRAVEL * 1000);

    // Land on the film page's own poster as soon as it has one.
    const started = performance.now();
    const land = () => {
      if (!alive) return;
      const target = document.querySelector("[data-poster-target] img") as HTMLElement | null;
      const box = target?.getBoundingClientRect();
      if (box && box.width > 0) {
        animate(
          copy,
          { x: box.left - from.left, y: box.top - from.top, scale: box.width / from.width },
          { duration: LAND, ease: EASE },
        );
        window.setTimeout(() => {
          if (!alive) return;
          animate(copy, { opacity: 0 }, { duration: FADE });
          window.setTimeout(discard, FADE * 1000 + 60);
        }, LAND * 1000);
        return;
      }
      // Never leave it stranded over the page if the film never arrives.
      if (performance.now() - started < 8000) requestAnimationFrame(land);
      else discard();
    };
    window.setTimeout(() => requestAnimationFrame(land), TRAVEL * 1000);
  }

  return (
    <div ref={root} onClickCapture={onClick}>
      {children}
    </div>
  );
}
