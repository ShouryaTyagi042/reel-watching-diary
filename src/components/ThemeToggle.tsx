"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SunDim, MoonStars } from "@phosphor-icons/react";

type Mode = "light" | "dark";

/**
 * Theme switch.
 *
 * Both themes are first-class. The page follows the system preference until
 * somebody chooses otherwise, and that choice is remembered locally. The
 * inline script in the layout applies the stored choice before first paint, so
 * there is no flash of the wrong theme.
 */
export function ThemeToggle() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const stored = readStoredTheme();
    setMode(stored ?? systemTheme());
  }, []);

  function choose(next: Mode) {
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("reel-theme", next);
    } catch {
      // Private browsing or blocked storage. The choice still applies to this page.
    }
  }

  // Render the well before hydration so the header does not shift.
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={() => choose(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
 className="relative grid h-9 w-9 place-items-center text-faint transition-colors hover:text-text"
    >
      {mode === null ? (
        <span className="h-4 w-4" />
      ) : (
        <motion.span
          key={mode}
          initial={reduce ? false : { opacity: 0, rotate: -35, scale: 0.8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
 className="grid place-items-center"
        >
          {isDark ? <MoonStars size={18} weight="duotone" /> : <SunDim size={19} weight="duotone" />}
        </motion.span>
      )}
    </button>
  );
}

function readStoredTheme(): Mode | null {
  try {
    const v = localStorage.getItem("reel-theme");
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Mode {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Runs before first paint. Kept as a string so it can be inlined in <head>
 * ahead of any stylesheet work.
 */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('reel-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}})()`;
