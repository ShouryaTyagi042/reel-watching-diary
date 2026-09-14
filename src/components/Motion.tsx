"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion primitives.
 *
 * Every animation here is doing one job: showing the reader what arrived and in
 * what order.
 *
 * A hazard worth knowing before reaching for these: `whileInView` with
 * `once: true` starts content at opacity 0 and reveals it when an observer
 * fires. If the container persists across a navigation while its children are
 * replaced, that observer has already fired and disconnected, and the new
 * children stay invisible. Use these for content that appears once on a page;
 * for anything that changes in place, such as a paginated grid, animate on
 * mount instead. MovieGrid does exactly that, for exactly this reason. Nothing loops, nothing hijacks the scroll, nothing moves that the
 * reader did not cause. Only transform and opacity are animated, and all of it
 * collapses to static under prefers-reduced-motion.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** A block that rises into place the first time it enters the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
 className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
 className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
 className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered container. Children must be `<StaggerItem>` and live in the same
 * client tree, which is what lets the parent drive their timing.
 */
export function Stagger({
  children,
 className,
  step = 0.045,
  as: Tag = "div",
}: {
  children: ReactNode;
 className?: string;
  step?: number;
  as?: "div" | "ul" | "ol";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[Tag];
  const variants: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: reduce ? 0 : step } },
  };
  return (
    <MotionTag
 className={className}
      variants={variants}
      initial={reduce ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, amount: 0.12 }}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  children,
 className,
  as: Tag = "div",
}: {
  children: ReactNode;
 className?: string;
  as?: "div" | "li";
}) {
  const MotionTag = motion[Tag];
  return (
    <MotionTag
 className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * A control that leans very slightly toward the pointer, then springs back.
 * Used once, on the primary action, as physical feedback rather than decoration.
 */
export function Magnetic({
  children,
 className,
  strength = 0.22,
}: {
  children: ReactNode;
 className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
 className={className}
      whileHover="lift"
      whileTap={{ scale: 0.98 }}
      onPointerMove={(e) => {
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * strength}px`);
        el.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * strength}px`);
      }}
      onPointerLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      }}
      style={{ translate: "var(--mx, 0) var(--my, 0)", transition: "translate 220ms cubic-bezier(.16,1,.3,1)" }}
    >
      {children}
    </motion.div>
  );
}
