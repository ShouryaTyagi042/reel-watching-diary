"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Naming a cinema.
 *
 * A cinema can be placed from photo GPS but not named, nothing in the data
 * carries a name. This is the one field the diary asks its owner to fill in, and
 * it survives re-imports.
 */
export function VenueNameForm({ id, name }: { id: string; name: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(name ?? "");
  const [editing, setEditing] = useState(!name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The name could not be saved.");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The name could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
 className="label text-faint transition-colors hover:text-accent"
        >
          Rename this cinema
        </button>
        {name && (
          <button
            type="button"
            onClick={() => { setValue(""); save(null); }}
 className="label text-faint transition-colors hover:text-accent"
          >
            Remove name
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(value.trim() || null); }}
 className="flex flex-wrap items-center gap-2"
    >
      <label className="sr-only" htmlFor={`venue-name-${id}`}>Cinema name</label>
      <input
        id={`venue-name-${id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What is this cinema called?"
        maxLength={120}
        autoFocus
 className="min-w-0 flex-1 border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none sm:max-w-xs"
      />
      <button
        type="submit"
        disabled={saving}
 className="border border-accent px-3.5 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {name !== null && (
        <button
          type="button"
          onClick={() => { setValue(name ?? ""); setEditing(false); setError(null); }}
 className="px-2 py-2 text-[13px] text-faint transition-colors hover:text-text"
        >
          Cancel
        </button>
      )}
      {error && <p role="alert" className="w-full text-[12px] text-accent">{error}</p>}
    </form>
  );
}
