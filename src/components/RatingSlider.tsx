"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RATING_MAX } from "@/lib/format";

const STEPS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);
const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.6 } as const;

/**
 * Rating, 1 to 10, as a slider.
 *
 * Ten bars that rise to meet the pointer: drag across them, click one, or use
 * the arrow keys. Blank means unrated, which is a real state and not a 0, so
 * the slider starts empty and has its own way back to empty.
 *
 * The pointer is handled on the track itself so a click lands on the bar under
 * it. Keyboard and screen readers get a native range input, visually hidden but
 * focused whenever the track is touched, so there is one control, not two.
 */
export function RatingSlider({
  value,
  onChange,
  label = "Rating",
}: {
  /** "" when unrated, otherwise "1" to "10". */
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const n = value === "" ? null : Number(value);
  const shown = dragging ? n : hover ?? n;
  const transition = reduce ? { duration: 0 } : SPRING;

  function stepAt(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 1);
    return Math.floor((x / rect.width) * RATING_MAX) + 1;
  }

  function set(v: number) {
    if (`${v}` !== value) onChange(`${v}`);
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="label" id="rating-label">{label}</span>
        <AnimatePresence initial={false}>
          {n !== null && (
            <motion.button
              type="button"
              onClick={() => { onChange(""); inputRef.current?.focus(); }}
              className="label text-faint transition-colors hover:text-accent"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 4 }}
            >
              Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-5 border-b border-line-strong pb-3 has-[input:focus-visible]:border-accent">
        {/* Readout. The number rolls rather than snaps, so a drag reads as motion. */}
        <div className="relative flex h-10 w-[4.5rem] shrink-0 items-baseline overflow-hidden" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={shown ?? "none"}
              className={`display text-[2.25rem] leading-10 tabular-nums ${
                shown === null ? "text-faint" : hover !== null && !dragging && hover !== n ? "text-dim" : "text-text"
              }`}
              initial={reduce ? false : { y: "70%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: "-70%", opacity: 0 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 38 }}
            >
              {shown ?? "–"}
            </motion.span>
          </AnimatePresence>
          <span className="data ml-1 text-[11px] text-faint">/{RATING_MAX}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            className="relative flex h-9 cursor-pointer touch-none items-end gap-[3px] select-none"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              set(stepAt(e.clientX));
              inputRef.current?.focus();
            }}
            onPointerMove={(e) => {
              const v = stepAt(e.clientX);
              if (dragging) set(v);
              else if (e.pointerType === "mouse") setHover(v);
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onPointerLeave={() => setHover(null)}
          >
            {STEPS.map((step) => {
              const on = n !== null && step <= n;
              const preview = hover !== null && !dragging && step <= hover;
              return (
                <motion.span
                  key={step}
                  aria-hidden
                  className={`block flex-1 origin-bottom ${on ? "bg-accent" : preview ? "bg-accent-quiet" : "bg-line-strong"}`}
                  style={{ height: `${30 + step * 7}%` }}
                  initial={false}
                  animate={{ scaleY: on ? 1 : preview ? 0.8 : 0.55 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { ...SPRING, delay: on && n !== null ? (step - 1) * 0.012 : 0 }
                  }
                />
              );
            })}

            <input
              ref={inputRef}
              type="range"
              min={1}
              max={RATING_MAX}
              step={1}
              value={n ?? 5}
              aria-labelledby="rating-label"
              aria-valuetext={n === null ? "Not rated" : `${n} out of ${RATING_MAX}`}
              onChange={(e) => set(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onChange(""); }
              }}
              className="sr-only"
            />
          </div>

          <div className="mt-1.5 flex gap-[3px]" aria-hidden>
            {STEPS.map((step) => (
              <motion.span
                key={step}
                className={`data flex-1 text-center text-[10px] ${n === step ? "text-accent" : "text-faint"}`}
                initial={false}
                animate={{ opacity: n === step ? 1 : 0.55, y: n === step ? -2 : 0 }}
                transition={transition}
              >
                {step}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
      <span className="mt-1.5 block text-[11px] text-faint">
        {n === null ? "Not rated. Drag or click a bar to rate." : "Drag, click, or use the arrow keys."}
      </span>
    </div>
  );
}
