// Deterministic mock data for the Phase 1 UX prototype.
import type { AgentSession, Command, InboxItem, Machine, Receipt } from "./index";

/**
 * Simulated delivery for the prototype. Emits receipts the way the real
 * service will: never reports "delivered" unless the laptop is reachable.
 */
export function simulateSend(
  cmd: Command,
  machine: Machine,
  item: InboxItem | undefined,
  onReceipt: (r: Receipt) => void,
): () => void {
  const at = () => new Date().toISOString();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, r: Omit<Receipt, "commandId" | "at">) =>
    timers.push(setTimeout(() => onReceipt({ commandId: cmd.id, at: at(), ...r }), ms));

  onReceipt({ commandId: cmd.id, status: "sending", at: at() });
  if (item && item.kind === "approval" && Date.parse(item.expiresAt) < Date.now()) {
    later(400, { status: "failed", reason: "Expired: the laptop prompt took over" });
  } else if (machine.connector === "offline") {
    later(400, { status: "queued", reason: `Laptop offline. Expires in 15 min if not delivered` });
  } else if (machine.connector === "paused") {
    later(400, { status: "failed", reason: "Connector is paused on the laptop" });
  } else {
    later(300, { status: "accepted" });
    later(1200, { status: "delivered" });
  }
  return () => timers.forEach(clearTimeout);
}

export interface MockSnapshot {
  machines: Machine[];
  sessions: AgentSession[];
  items: InboxItem[];
}

const ago = (now: number, s: number) => new Date(now - s * 1000).toISOString();
const ahead = (now: number, s: number) => new Date(now + s * 1000).toISOString();

export function mockSnapshot(now: number): MockSnapshot {
  return {
    machines: [{ id: "m-laptop", name: "rajesh-laptop", connector: "online", lastSeenAt: ago(now, 4) }],
    sessions: [
      { id: "s-cc-api", provider: "claude-code", machineId: "m-laptop", project: "oneview", title: "Fastify API skeleton", control: "approvals", status: "waiting", updatedAt: ago(now, 20) },
      { id: "s-cc-web", provider: "claude-code", machineId: "m-laptop", project: "mindx-cx", title: "Fix checkout validation", control: "two-way", status: "waiting", updatedAt: ago(now, 95) },
      { id: "s-cx-conn", provider: "codex", machineId: "m-laptop", project: "oneview", title: "Connector reconnect backoff", control: "two-way", status: "waiting", sandbox: "read-only", updatedAt: ago(now, 40) },
      { id: "s-cx-desk", provider: "codex", machineId: "m-laptop", project: "mindjobcard", title: "Refactor PDF export", control: "observe", status: "running", sandbox: "workspace-write", updatedAt: ago(now, 300) },
      { id: "s-cc-old", provider: "claude-code", machineId: "m-laptop", project: "oneview", title: "Write implementation plan", control: "approvals", status: "ended", updatedAt: ago(now, 7200) },
    ],
    items: [
      { id: "i-1", kind: "approval", sessionId: "s-cc-api", createdAt: ago(now, 20), state: "open", tool: "Bash", command: "pnpm add fastify@5 @fastify/websocket", cwd: "C:/Users/rajes/Documents/OneView/apps/api", reason: "Install the API server dependencies", risk: ["network"], expiresAt: ahead(now, 40) },
      { id: "i-2", kind: "approval", sessionId: "s-cx-conn", createdAt: ago(now, 40), state: "open", tool: "shell", command: "git push origin phase1/ux-prototype", cwd: "C:/Users/rajes/Documents/OneView", reason: "Push the reconnect fix", risk: ["git-push"], expiresAt: ahead(now, 20) },
      { id: "i-3", kind: "approval", sessionId: "s-cc-web", createdAt: ago(now, 95), state: "open", tool: "Edit", filePath: "src/checkout/validate.ts", linesAdded: 14, linesRemoved: 3, cwd: "C:/Users/rajes/mindx-cx", risk: [], expiresAt: ahead(now, 50) },
      { id: "i-4", kind: "question", sessionId: "s-cc-web", createdAt: ago(now, 120), state: "open", question: "Should invalid postcodes block checkout or show a warning?", choices: ["Block checkout", "Show a warning", "Ask product"], recommendation: "Show a warning" },
      { id: "i-5", kind: "completion", sessionId: "s-cx-desk", createdAt: ago(now, 300), state: "open", summary: "Refactored PDF export into a streaming writer. 6 files changed, tests passing." },
      { id: "i-6", kind: "approval", sessionId: "s-cc-old", createdAt: ago(now, 7300), state: "answered-elsewhere", tool: "Bash", command: "rm -rf dist", cwd: "C:/Users/rajes/Documents/OneView", risk: ["delete"], expiresAt: ago(now, 7240) },
      { id: "i-7", kind: "approval", sessionId: "s-cc-old", createdAt: ago(now, 7400), state: "expired", tool: "Bash", command: "curl https://example.com/install.sh", cwd: "C:/Users/rajes", risk: ["network", "outside-project"], expiresAt: ago(now, 7340) },
    ],
  };
}
