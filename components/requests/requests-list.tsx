"use client";

import { useMemo, useState } from "react";
import { RequestCard } from "@/components/dashboard/request-card";
import type { ListTicket } from "@/lib/data/requests";
import {
  matchesFilter,
  PRIORITY_RANK,
  type RequestFilter,
} from "@/lib/labels";

const TABS: { id: RequestFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting for you" },
  { id: "resolved", label: "Resolved" },
];

type SortKey = "updated" | "priority" | "opened";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "Sort: Recently updated" },
  { id: "priority", label: "Sort: Priority" },
  { id: "opened", label: "Sort: Date opened" },
];

export function RequestsList({ tickets }: { tickets: ListTicket[] }) {
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => matchesFilter(t.status, "open")).length,
      waiting: tickets.filter((t) => matchesFilter(t.status, "waiting")).length,
      resolved: tickets.filter((t) => matchesFilter(t.status, "resolved")).length,
    }),
    [tickets],
  );

  const rows = useMemo(() => {
    const filtered = tickets.filter((t) => matchesFilter(t.status, filter));
    return [...filtered].sort((a, b) => {
      if (sort === "priority") {
        const rank =
          (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        return rank !== 0 ? rank : (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0);
      }
      if (sort === "opened") {
        return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
      }
      return (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0);
    });
  }, [tickets, filter, sort]);

  return (
    <div>
      {/* FILTER TABS + SORT */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3.5">
        <div
          className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-field bg-card p-1"
          role="group"
          aria-label="Filter requests"
        >
          {TABS.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(t.id)}
                className={`inline-flex items-center rounded-lg px-[13px] py-2 text-[13px] font-semibold ${
                  active ? "bg-gold text-navy" : "bg-transparent text-muted-2"
                }`}
              >
                {t.label}
                <span
                  className={`ml-[7px] rounded-full px-[7px] py-px text-[11px] font-bold tabular-nums ${
                    active ? "bg-navy/15 text-navy" : "bg-pill-bg text-pill-text"
                  }`}
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative inline-flex items-center">
          <label htmlFor="sort" className="sr-only">
            Sort requests
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="appearance-none rounded-[9px] border border-field bg-[color:var(--field-bg)] py-[9px] pl-[13px] pr-[30px] text-[13px] font-semibold text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute right-2.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* LIST / EMPTY */}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {rows.map((t) => (
            <RequestCard key={t.id} ticket={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <div className="mx-auto mb-[18px] flex h-[66px] w-[66px] items-center justify-center rounded-[18px] bg-teal-tint">
            <svg
              aria-hidden="true"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="mb-2 text-[18px] font-bold text-ink">
            No requests in this view
          </h3>
          <p className="mx-auto max-w-[380px] text-[14px] leading-[1.6] text-body">
            Try another filter, or open a new request whenever you need academic
            support.
          </p>
        </div>
      )}
    </div>
  );
}
