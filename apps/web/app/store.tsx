"use client";

import {
  mockSnapshot,
  simulateSend,
  type AgentSession,
  type Command,
  type InboxItem,
  type Machine,
  type MockSnapshot,
  type Receipt,
} from "@oneview/protocol";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Demo-only switches for exercising empty/loading/error/offline states. */
export interface DemoFlags {
  connector: Machine["connector"];
  view: "normal" | "empty" | "loading" | "error";
}

export interface PendingSend {
  session: AgentSession;
  item?: InboxItem;
  kind: Command["kind"];
  text: string;
}

interface Store {
  ready: boolean;
  snapshot: MockSnapshot;
  machine: Machine;
  flags: DemoFlags;
  setFlags: (f: Partial<DemoFlags>) => void;
  receipts: Record<string, Receipt>; // by item id or session id (free replies)
  confirm: PendingSend | null;
  requestSend: (p: PendingSend) => void;
  cancelSend: () => void;
  commitSend: (text: string) => void;
  sessionOf: (id: string) => AgentSession | undefined;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // Mock data is time-relative, so build it on the client only to avoid hydration mismatch.
  const [snapshot, setSnapshot] = useState<MockSnapshot | null>(null);
  const [flags, setFlagsState] = useState<DemoFlags>({ connector: "online", view: "normal" });
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [confirm, setConfirm] = useState<PendingSend | null>(null);

  useEffect(() => setSnapshot(mockSnapshot(Date.now())), []);

  const setFlags = useCallback((f: Partial<DemoFlags>) => setFlagsState((p) => ({ ...p, ...f })), []);

  const base = snapshot ?? { machines: [], sessions: [], items: [] };
  const machine: Machine = {
    ...(base.machines[0] ?? { id: "m-laptop", name: "laptop", lastSeenAt: new Date(0).toISOString(), connector: "offline" }),
    connector: flags.connector,
  };

  const commitSend = useCallback(
    (text: string) => {
      if (!confirm) return;
      const key = confirm.item?.id ?? confirm.session.id;
      const cmd: Command = {
        id: crypto.randomUUID(),
        sessionId: confirm.session.id,
        itemId: confirm.item?.id,
        kind: confirm.kind,
        text: text.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      simulateSend(cmd, machine, confirm.item, (r) => {
        setReceipts((prev) => ({ ...prev, [key]: r }));
        if (r.status === "delivered" && confirm.item) {
          const itemId = confirm.item.id;
          setSnapshot((s) => s && { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, state: "answered" } : i)) });
        }
      });
      setConfirm(null);
    },
    [confirm, machine],
  );

  const value = useMemo<Store>(
    () => ({
      ready: snapshot !== null,
      snapshot: flags.view === "empty" ? { ...base, items: [], sessions: [] } : base,
      machine,
      flags,
      setFlags,
      receipts,
      confirm,
      requestSend: setConfirm,
      cancelSend: () => setConfirm(null),
      commitSend,
      sessionOf: (id) => base.sessions.find((s) => s.id === id),
    }),
    [snapshot, base, machine, flags, setFlags, receipts, confirm, commitSend],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
