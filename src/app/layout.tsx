import type { Metadata } from "next";
import { Fraunces, Archivo, Space_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import "./globals.css";

// Display: Fraunces, with the "wonk" and soft axes turned up a little — warm and
// slightly irregular, the way a handwritten diary heading would be.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

/**
 * The diary reads a local SQLite file that changes outside the build (a re-import,
 * naming a cinema). Rendering on demand keeps every page in step with it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Reel — a watching diary", template: "%s · Reel" },
  description:
    "A personal diary of films and shows watched, imported from Notion, with the cinemas they were seen in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable} ${spaceMono.variable}`}>
      {/*
        Browser extensions (Grammarly, password managers, translators) add their
        own attributes to <body> before React hydrates, which React reports as a
        mismatch. suppressHydrationWarning applies to this element's own
        attributes only — one level deep — so genuine mismatches inside the app
        are still reported.
      */}
      <body className="min-h-screen" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-sconce focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6 lg:px-10">
          {children}
        </main>
        <footer className="border-t border-edge/60">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
            <p className="plate text-[11px] text-faint">
              Imported from the Notion export “Movies and TV Shows Diary”.
            </p>
            <Link href="/data-health" className="plate text-[11px] text-faint transition-colors hover:text-sconce">
              What the import found →
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
