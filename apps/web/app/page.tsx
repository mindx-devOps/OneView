"use client";

import { useState } from "react";
import { ItemCard, StateGate } from "./components";
import { useStore } from "./store";

const FILTERS = ["Needs you", "Approvals", "Questions", "Done"] as const;
type Filter = (typeof FILTERS)[number];

export default function InboxPage() {
  const { snapshot } = useStore();
  const [filter, setFilter] = useState<Filter>("Needs you");

  const items = [...snapshot.items]
    .filter((i) => {
      const open = i.state === "open" && !(i.kind === "approval" && Date.parse(i.expiresAt) <= Date.now());
      if (filter === "Needs you") return open && i.kind !== "completion";
      if (filter === "Approvals") return open && i.kind === "approval";
      if (filter === "Questions") return open && i.kind === "question";
      return !open || i.kind === "completion";
    })
    // Approvals first (time-boxed), then newest.
    .sort((a, b) => Number(b.kind === "approval") - Number(a.kind === "approval") || Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <>
      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={f === filter} className={f === filter ? "active" : ""} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <StateGate empty={<>No sessions yet. Start the connector on your laptop to see Claude Code and Codex sessions here.</>}>
        {items.length === 0 ? (
          <div className="placeholder">Nothing here. You’re all caught up.</div>
        ) : (
          <div className="list">{items.map((i) => <ItemCard key={i.id} item={i} />)}</div>
        )}
      </StateGate>
    </>
  );
}
