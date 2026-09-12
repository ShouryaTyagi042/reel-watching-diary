import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The ledger strip: the diary's running totals, set like a printed receipt.
 * Numbers are the loud part; the labels stay quiet underneath.
 */
export function Ledger({ items }: { items: LedgerItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => {
        const body = (
          <div className="h-full bg-bg px-4 py-5 transition-colors group-hover:bg-surface">
            <dd className="display text-[30px] leading-none text-text">
              {it.value}
              {it.suffix && <span className="ml-1 text-base text-faint">{it.suffix}</span>}
            </dd>
            <dt className="label mt-2.5">{it.label}</dt>
            {it.note && <p className="mt-1 text-[11px] leading-snug text-faint">{it.note}</p>}
          </div>
        );
        return it.href ? (
          <Link key={it.label} href={it.href} className="group block">
            {body}
          </Link>
        ) : (
          <div key={it.label} className="group">
            {body}
          </div>
        );
      })}
    </dl>
  );
}

export interface LedgerItem {
  label: string;
  value: ReactNode;
  suffix?: string;
  note?: string;
  href?: string;
}
