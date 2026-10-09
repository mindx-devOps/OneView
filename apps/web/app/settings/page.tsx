"use client";

import Link from "next/link";
import { since } from "../components";
import { useStore, type DemoFlags } from "../store";

export default function ConnectionPage() {
  const { machine, flags, setFlags } = useStore();
  return (
    <div className="list">
      <section className="card">
        <div className="card-title">Laptop</div>
        <div className="row">
          <strong>{machine.name}</strong>
          <span className={`status status-${machine.connector}`}>{machine.connector}</span>
          <span className="muted small">last seen {since(machine.lastSeenAt)}</span>
        </div>
        <p className="muted small">
          The connector runs on your laptop and only connects outward. Pause or stop it from the laptop tray. OneView never opens a port on your laptop.
        </p>
        <div className="actions">
          <button className="danger" onClick={() => alert("Prototype: device revocation comes with pairing in Phase 2.")}>Disconnect this laptop</button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">What OneView stores</div>
        <ul className="small">
          <li>Session metadata (provider, project name, title, status)</li>
          <li>Open questions and approval requests, deleted shortly after they are answered or expire</li>
          <li>Never: source files, diffs, screenshots, API keys, audio, full transcripts</li>
        </ul>
      </section>

      <section className="card">
        <div className="card-title">Pairing</div>
        <Link href="/pair">Pair a new device →</Link>
      </section>

      <section className="card demo">
        <div className="card-title">Prototype controls</div>
        <label className="field">
          <span className="muted small">Connector state</span>
          <select value={flags.connector} onChange={(e) => setFlags({ connector: e.target.value as DemoFlags["connector"] })}>
            <option value="online">online</option>
            <option value="offline">offline</option>
            <option value="paused">paused</option>
          </select>
        </label>
        <label className="field">
          <span className="muted small">Inbox view</span>
          <select value={flags.view} onChange={(e) => setFlags({ view: e.target.value as DemoFlags["view"] })}>
            <option value="normal">normal</option>
            <option value="empty">empty</option>
            <option value="loading">loading</option>
            <option value="error">error</option>
          </select>
        </label>
      </section>
    </div>
  );
}
