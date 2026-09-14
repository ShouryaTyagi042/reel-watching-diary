import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/SignInForm";
import { isAdmin, authIsConfigured } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await isAdmin()) redirect("/");

  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;

  // Only ever return somewhere inside this app. A bare "/" is the fallback, and
  // "//evil.example" is a protocol-relative URL, not a local path.
  const next = raw && /^\/(?!\/)/.test(raw) ? raw : "/";

  return (
    <>
      <header className="pt-16 sm:pt-24">
        <h1 className="display text-[clamp(2.5rem,6vw,4rem)]">Sign in</h1>
        <p className="mt-4 max-w-prose text-[14px] leading-relaxed text-faint">
          The diary is readable by anyone. Adding and editing entries is not.
        </p>
      </header>

      {authIsConfigured() ? (
        <SignInForm next={next} />
      ) : (
        <div className="mt-10 max-w-prose border border-line p-5">
          <h2 className="display text-[19px]">No password is set yet</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-dim">
            Generate one, then put the printed lines in <code className="data text-dim">.env.local</code>
            {" "}and restart the server.
          </p>
          <pre className="mt-4 overflow-x-auto border border-line bg-surface px-4 py-3 data text-dim">
npm run set-password
          </pre>
        </div>
      )}

      <p className="mt-10 text-[13px] text-faint">
        <Link href="/" className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent">
          Back to the diary
        </Link>
      </p>
    </>
  );
}
