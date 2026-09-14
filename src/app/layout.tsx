import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { isAdmin } from "@/lib/auth";
import { THEME_BOOTSTRAP } from "@/components/ThemeToggle";
import "./globals.css";

/*
  Type: a sans display with real character, set tight and heavy, against a
  neutral text face and a mono for anything numeric. Hierarchy comes from
  weight and colour rather than raw scale.
*/
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz", "wdth"],
  display: "swap",
});
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

/** The diary reads a local database that changes outside the build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Reel", template: "%s / Reel" },
  description:
    "A personal diary of the films and shows you have watched, and the cinemas you saw them in.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  return (
    <html
      lang="en"
 className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a stored theme choice before first paint, so the page never
            flashes the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-[100dvh]" suppressHydrationWarning>
        <a
          href="#main"
 className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-on-accent"
        >
          Skip to content
        </a>
        <Nav admin={admin} />
        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-28 sm:px-6 lg:px-10">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
            <p className="data text-[11px] text-faint">
              A record of what you watched, and where.
            </p>
            <Link
              href="/data-health"
 className="data text-[11px] text-faint transition-colors hover:text-accent"
            >
              Import report
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
