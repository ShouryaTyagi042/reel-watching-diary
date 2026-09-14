"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * A page opens through a cross-shaped aperture.
 *
 * Adapted from the Codrops "grid to full preview" technique, which clips an
 * element to a plus shape and animates the arm widths. There the cross is the
 * gutter between four tiles, and closing it merges them into one image. Here it
 * runs the other way: the arms grow from a point until they have swallowed the
 * whole rectangle, so the films are uncovered by a shutter rather than faded in.
 *
 * Two things the technique assumes that are not true of a page of film, and what
 * this does about them:
 *
 *   The demo's grid is roughly square and fits on screen. An arm given as a
 *   percentage degenerates on anything else: a films grid is 358x994 on a phone,
 *   where a 22% arm is 218px across a 358px-wide element and the cross reads as
 *   a bar with two notches. The arm is taken from the SHORT side instead, so it
 *   is the same number of pixels each way and stays a cross at any shape.
 *
 *   The demo opens from the middle of the element, which is also the middle of
 *   the screen. A long page's middle is far below the fold, so the shutter would
 *   open somewhere nobody is looking and only a sliver would creep into view.
 *   The centre is placed where the content actually meets the viewport.
 */

const ARM = 0.22; // arm thickness at mid-open, as a fraction of the short side

function cross(t: number, e: number, cx = 50, cy = 50): string {
  const l = cx - t / 2;
  const r = cx + t / 2;
  const top = cy - e / 2;
  const bot = cy + e / 2;
  return `polygon(${l}% 0%, ${r}% 0%, ${r}% ${top}%, 100% ${top}%, 100% ${bot}%, ${r}% ${bot}%, ${r}% 100%, ${l}% 100%, ${l}% ${bot}%, 0% ${bot}%, 0% ${top}%, ${l}% ${top}%)`;
}

/** The same twelve points, tracing the whole rectangle. */
const OPEN = cross(100, 100);

/**
 * Layout effects run before paint, so the shutter can be closed after the
 * server has already described the grid as visible.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Shape {
  shut: string;
  mid: string;
}

export function Aperture({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<Shape | null>(null);

  /*
   * The closed shape is applied from the client, never rendered.
   *
   * Putting it in `initial` would mean the server sends the page clipped down to
   * a point: if the bundle is slow, blocked or broken, a visitor gets an empty
   * rectangle with no sign there was anything in it. The markup goes out
   * complete and the aperture shuts in a layout effect, which React flushes
   * before paint, so it still costs nothing visually.
   */
  useBeforePaint(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const seen = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const arm = ARM * Math.min(r.width, seen || r.height);
    const centre = (Math.max(r.top, 0) + Math.min(r.bottom, window.innerHeight)) / 2;
    const cy = Math.min(90, Math.max(10, ((centre - r.top) / r.height) * 100));

    setShape({
      shut: cross(0, 0, 50, cy),
      mid: cross((arm / r.width) * 100, (arm / r.height) * 100, 50, cy),
    });
  }, [reduce]);

  /*
   * One element in both cases, deliberately. Swapping to a plain <div> when the
   * visitor prefers reduced motion makes the client render a different tree than
   * the server did, which React reports as a hydration mismatch. Holding `shape`
   * at null is enough: the aperture never shuts, and the fallback below leaves
   * the grid unclipped.
   */
  return (
    <motion.div
      ref={ref}
      data-aperture=""
      initial={false}
      animate={
        shape
          ? { clipPath: [shape.shut, shape.mid, OPEN], scale: [1.04, 1.02, 1] }
          : { clipPath: "none", scale: 1 }
      }
      transition={{ duration: 0.95, times: [0, 0.45, 1], ease: [0.65, 0, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}
