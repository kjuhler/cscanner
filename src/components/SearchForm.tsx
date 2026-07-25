"use client";

import { useActionState } from "react";
import { searchPlayer, type SearchState } from "@/lib/actions/search";

const initial: SearchState = {};

type SearchFormProps = {
  compact?: boolean;
  defaultValue?: string;
};

export function SearchForm({ compact = false, defaultValue }: SearchFormProps) {
  const [state, action, pending] = useActionState(searchPlayer, initial);

  return (
    <form action={action} className="w-full">
      <div
        className={
          compact
            ? "flex flex-col gap-2 sm:flex-row sm:items-stretch"
            : "flex flex-col gap-3 sm:flex-row sm:items-stretch"
        }
      >
        <label className="sr-only" htmlFor="query">
          Steam ID or URL
        </label>
        <input
          id="query"
          name="query"
          type="text"
          defaultValue={defaultValue}
          placeholder="Steam ID, profile URL, or vanity name"
          autoComplete="off"
          className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--amber)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 bg-[var(--amber)] px-6 py-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition hover:bg-[var(--amber-bright)] disabled:opacity-60"
        >
          {pending ? "Checking…" : "Check Stats"}
        </button>
      </div>
      {state.error ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
