"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Composer, ControlBadge, ItemCard, ProviderBadge, StateGate } from "../../components";
import { useStore } from "../../store";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { snapshot, sessionOf, machine } = useStore();
  const session = sessionOf(id);

  return (
    <StateGate empty={<>Session not found.</>}>
      {!session ? (
        <div className="placeholder">Session not found. <Link href="/sessions">Back to sessions</Link></div>
      ) : (
        <>
          <Link href="/sessions" className="muted small">← Sessions</Link>
          <section className="detail-head">
            <div className="session-line">
              <ProviderBadge provider={session.provider} />
              <h1>{session.project}</h1>
            </div>
            <div>{session.title}</div>
            <div className="row">
              <span className={`status status-${session.status}`}>{session.status}</span>
              <ControlBadge session={session} />
              {session.sandbox && <span className="badge">sandbox: {session.sandbox}</span>}
              <span className="muted small">on {machine.name}</span>
            </div>
          </section>
          <div className="list">
            {snapshot.items
              .filter((i) => i.sessionId === session.id)
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
              .map((i) => <ItemCard key={i.id} item={i} showSession={false} />)}
          </div>
          {session.status !== "ended" && <Composer session={session} />}
        </>
      )}
    </StateGate>
  );
}
