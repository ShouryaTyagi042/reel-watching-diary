"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LockSimple } from "@phosphor-icons/react";

/**
 * Sign in.
 *
 * On success this does a full page load rather than a router refresh. The
 * session is a property of the whole app, not of one route, and a soft
 * navigation can leave cached router entries rendered as though nobody signed
 * in.
 */
export function SignInForm({ next }: { next: string }) {
  const reduce = useReducedMotion();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "That did not work.");
      window.location.assign(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mt-10 max-w-sm"
    >
      <label className="block">
        <span className="label mb-2 block">Password</span>
        <div className="relative">
          <LockSimple
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            required
            className="w-full border border-line bg-surface py-3 pl-9 pr-3 text-[15px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </label>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-accent pl-4 text-[13px] leading-relaxed text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !password}
        className="mt-6 w-full bg-accent px-5 py-3 text-[14px] font-medium text-on-accent transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Checking" : "Sign in"}
      </button>
    </motion.form>
  );
}
