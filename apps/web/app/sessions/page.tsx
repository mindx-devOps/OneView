"use client";

import Link from "next/link";
import { ControlBadge, ProviderBadge, StateGate, since } from "../components";
import { useStore } from "../store";

export default function SessionsPage() {
  const { snapshot, machine } = useStore();
  const sessions = [...snapshot.sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return (
    <StateGate empty={<>No sessions on {machine.name} yet.</>}>
      <div className="list">
        {sessions.map((s) => {
          const open = snapshot.items.filter((i) => i.sessionId === s.id && i.state === "open" && i.kind !== "completion").length;
          return (
            <Link key={s.id} href={`/sessions/${s.id}`} className={`card session-card ${s.status === "ended" ? "closed" : ""}`}>
              <header>
                <div className="session-line">
                  <ProviderBadge provider={s.provider} />
                  <strong>{s.project}</strong>
                </div>
                <span className="muted small">{since(s.updatedAt)}</span>
              </header>
              <div>{s.title}</div>
              <div className="row">
                <span className={`status status-${s.status}`}>{s.status}</span>
                <ControlBadge session={s} />
                {open > 0 && <span className="count">{open} waiting</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </StateGate>
  );
}
