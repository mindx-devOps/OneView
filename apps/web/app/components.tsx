"use client";

import {
  PROVIDER_LABEL,
  canApprove,
  canReply,
  type AgentSession,
  type ApprovalItem,
  type InboxItem,
  type Provider,
  type Receipt,
  type RiskTag,
} from "@oneview/protocol";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "./store";

export function since(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Nav() {
  const path = usePathname();
  const links = [
    ["/", "Inbox"],
    ["/sessions", "Sessions"],
    ["/settings", "Connection"],
  ] as const;
  return (
    <nav className="nav">
      <Link href="/" className="brand">OneView</Link>
      {links.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? "active" : ""}>{label}</Link>
      ))}
    </nav>
  );
}

export function ConnectionBanner() {
  const { machine } = useStore();
  useNow(5000);
  if (machine.connector === "online") {
    return <div className="banner ok">● {machine.name} connected · last seen {since(machine.lastSeenAt)}</div>;
  }
  if (machine.connector === "paused") {
    return <div className="banner warn">❚❚ Connector paused on {machine.name}. Nothing will be sent until you resume it on the laptop.</div>;
  }
  return (
    <div className="banner bad">
      ○ {machine.name} is offline (last seen {since(machine.lastSeenAt)}). Replies will queue and expire after 15 minutes. Approvals fall back to the laptop prompt.
    </div>
  );
}

export function ProviderBadge({ provider }: { provider: Provider }) {
  return <span className={`badge provider-${provider}`}>{PROVIDER_LABEL[provider]}</span>;
}

const CONTROL_LABEL: Record<AgentSession["control"], string> = {
  "two-way": "Approve + reply",
  approvals: "Approvals only",
  observe: "View only",
};

export function ControlBadge({ session }: { session: AgentSession }) {
  return <span className={`badge control-${session.control}`} title="What OneView can do in this session">{CONTROL_LABEL[session.control]}</span>;
}

const RISK_LABEL: Record<RiskTag, string> = {
  delete: "Deletes files",
  "git-push": "Git push",
  network: "Network",
  "outside-project": "Outside project",
};

export function SessionLine({ session }: { session: AgentSession }) {
  return (
    <div className="session-line">
      <ProviderBadge provider={session.provider} />
      <strong>{session.project}</strong>
      <span className="muted">· {session.title}</span>
    </div>
  );
}

export function ReceiptLine({ receipt }: { receipt?: Receipt }) {
  if (!receipt) return null;
  const label: Record<Receipt["status"], string> = {
    sending: "Sending…",
    queued: "Queued",
    accepted: "Accepted by service",
    delivered: "Delivered to session",
    failed: "Failed",
    expired: "Expired",
  };
  return (
    <div className={`receipt receipt-${receipt.status}`} role="status">
      {label[receipt.status]}
      {receipt.reason ? ` · ${receipt.reason}` : ""}
    </div>
  );
}

function Countdown({ item }: { item: ApprovalItem }) {
  const now = useNow();
  const left = Math.ceil((Date.parse(item.expiresAt) - now) / 1000);
  return <span className={left <= 15 ? "countdown urgent" : "countdown"}>{left}s before the laptop prompt takes over</span>;
}

export function ItemCard({ item, showSession = true }: { item: InboxItem; showSession?: boolean }) {
  const { sessionOf, receipts, requestSend } = useStore();
  const session = sessionOf(item.sessionId);
  const [note, setNote] = useState<string | null>(null);
  const now = useNow();
  if (!session) return null;
  const receipt = receipts[item.id];
  // Past its window, an approval belongs to the laptop prompt even before the server says so.
  const timedOut = item.kind === "approval" && item.state === "open" && Date.parse(item.expiresAt) <= now;
  if (timedOut) item = { ...item, state: "expired" };
  const closed = item.state !== "open";
  const busy = receipt && receipt.status !== "failed";

  return (
    <article className={`card kind-${item.kind} ${closed ? "closed" : ""}`}>
      <header>
        {showSession ? <SessionLine session={session} /> : <span />}
        <span className="muted small">{since(item.createdAt)}</span>
      </header>

      {item.kind === "approval" && (
        <>
          <div className="card-title">Permission request · {item.tool}</div>
          {item.command && <pre className="command">{item.command}</pre>}
          {item.filePath && (
            <div className="file-edit">
              {item.filePath} <span className="add">+{item.linesAdded}</span> <span className="del">−{item.linesRemoved}</span>
            </div>
          )}
          <div className="meta">in <code>{item.cwd}</code></div>
          {item.reason && <div className="meta">Reason: {item.reason}</div>}
          {session.sandbox && <div className="meta">Sandbox: <strong>{session.sandbox}</strong> (approving does not change it)</div>}
          {item.risk.length > 0 && (
            <div className="risks">{item.risk.map((r) => <span key={r} className="risk">⚠ {RISK_LABEL[r]}</span>)}</div>
          )}
          {item.state === "open" && <Countdown item={item} />}
          {item.state === "open" && canApprove(session) && !busy && (
            note === null ? (
              <div className="actions">
                <button className="primary" onClick={() => requestSend({ session, item, kind: "approve", text: "" })}>Allow once</button>
                <button onClick={() => requestSend({ session, item, kind: "deny", text: "" })}>Deny</button>
                <button className="ghost" onClick={() => setNote("")}>Deny with note…</button>
              </div>
            ) : (
              <div className="actions column">
                <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell the agent what to do instead" rows={2} />
                <div className="actions">
                  <button onClick={() => requestSend({ session, item, kind: "deny", text: note })}>Deny with note</button>
                  <button className="ghost" onClick={() => setNote(null)}>Cancel</button>
                </div>
              </div>
            )
          )}
        </>
      )}

      {item.kind === "question" && (
        <>
          <div className="card-title">{item.question}</div>
          {item.state === "open" && canReply(session) && !busy && (
            <div className="actions wrap">
              {item.choices.map((c) => (
                <button key={c} className={c === item.recommendation ? "primary" : ""} onClick={() => requestSend({ session, item, kind: "reply", text: c })}>
                  {c}{c === item.recommendation ? " · recommended" : ""}
                </button>
              ))}
              <button className="ghost" onClick={() => requestSend({ session, item, kind: "reply", text: "" })}>Write a reply…</button>
            </div>
          )}
        </>
      )}

      {item.kind === "completion" && (
        <>
          <div className="card-title">Finished</div>
          <p>{item.summary}</p>
        </>
      )}

      {item.state === "answered" && <div className="receipt receipt-delivered">Answered from OneView</div>}
      {item.state === "answered-elsewhere" && <div className="muted small">Answered on the laptop</div>}
      {item.state === "expired" && <div className="muted small">Expired: the laptop prompt took over</div>}
      {item.state === "open" && <ReceiptLine receipt={receipt} />}
      {!canApprove(session) && item.kind === "approval" && item.state === "open" && (
        <div className="muted small">View only: answer this on the laptop.</div>
      )}
    </article>
  );
}

/** Explicit confirmation: reads back the exact target before anything is sent. */
export function ConfirmSheet() {
  const { confirm, cancelSend, commitSend, machine } = useStore();
  const [text, setText] = useState("");
  useEffect(() => setText(confirm?.text ?? ""), [confirm]);
  if (!confirm) return null;
  const { session, kind } = confirm;
  const verb = kind === "approve" ? "Allow once" : kind === "deny" ? "Deny" : "Send reply";
  const needsText = kind === "reply" && !text.trim();

  return (
    <div className="sheet-backdrop" onClick={cancelSend}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Confirm send" onClick={(e) => e.stopPropagation()}>
        <div className="muted small">Sending to</div>
        <div className="target">
          <ProviderBadge provider={session.provider} /> <strong>{session.project}</strong> · {session.title}
          <div className="muted small">on {machine.name}</div>
        </div>
        {kind === "reply" || kind === "deny" ? (
          <label className="field">
            <span className="muted small">{kind === "deny" ? "Note (optional)" : "Your reply. Edit before sending"}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
          </label>
        ) : (
          <pre className="command">{confirm.item?.kind === "approval" ? confirm.item.command ?? confirm.item.filePath : ""}</pre>
        )}
        {machine.connector !== "online" && (
          <div className="banner warn small">Laptop is {machine.connector}. This will not be delivered right away.</div>
        )}
        <div className="actions">
          <button className={kind === "deny" ? "danger" : "primary"} disabled={needsText} onClick={() => commitSend(text)}>{verb}</button>
          <button className="ghost" onClick={cancelSend}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Free-form reply for two-way sessions. Web is text-first; voice ships on Android first. */
export function Composer({ session }: { session: AgentSession }) {
  const { requestSend, receipts } = useStore();
  const [text, setText] = useState("");
  if (!canReply(session)) {
    return <div className="muted small composer-disabled">Replies are not available for this session ({session.control === "observe" ? "Codex desktop threads are view only" : "existing Claude Code sessions support approvals only"}).</div>;
  }
  return (
    <div className="composer">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${PROVIDER_LABEL[session.provider]} in ${session.project}`} rows={2} />
      <div className="actions">
        <button className="primary" disabled={!text.trim()} onClick={() => { requestSend({ session, kind: "reply", text }); setText(""); }}>Review & send</button>
        <span className="muted small">Voice input comes to the web later. Use the Android app for push-to-talk.</span>
      </div>
      <ReceiptLine receipt={receipts[session.id]} />
    </div>
  );
}

/** Renders loading / error / empty demo states in one place. */
export function StateGate({ empty, children }: { empty: ReactNode; children: ReactNode }) {
  const { ready, flags } = useStore();
  if (!ready || flags.view === "loading") return <div className="placeholder"><div className="skeleton" /><div className="skeleton" /><div className="skeleton short" /></div>;
  if (flags.view === "error") return <div className="placeholder error">Couldn’t load your inbox. <button onClick={() => location.reload()}>Retry</button></div>;
  if (flags.view === "empty") return <div className="placeholder">{empty}</div>;
  return <>{children}</>;
}
