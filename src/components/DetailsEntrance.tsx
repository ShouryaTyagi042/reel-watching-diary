"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The film's details arrive after its poster has settled.
 *
 * Deliberately plain: the poster flying up to the corner is the transition, and
 * anything more here would compete with it.
 *
 * The hidden state is applied from the client, never rendered. In `initial` it
 * would mean the server sends the details already invisible, and a bundle that
 * is slow, blocked or broken would leave a film page with nothing on it. React
 * flushes layout effects before paint, so starting visible costs nothing.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function DetailsEntrance({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState(false);

  useBeforePaint(() => {
    if (!reduce) setRun(true);
  }, [reduce]);

  return (
    <motion.div
      initial={false}
      animate={run ? { opacity: [0, 1], y: [10, 0] } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
