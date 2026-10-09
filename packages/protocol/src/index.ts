// Shared OneView protocol types. Consumed by web, android, api and connector.

export type Provider = "claude-code" | "codex";

export const PROVIDER_LABEL: Record<Provider, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
};

/** How long the phone gets to answer an approval before the laptop prompt takes over. */
export const APPROVAL_WINDOW_MS = 60_000;
/** Queued commands that cannot reach the laptop within this window expire instead of arriving late. */
export const COMMAND_TTL_MS = 15 * 60_000;

export interface Machine {
  id: string;
  name: string;
  connector: "online" | "offline" | "paused";
  lastSeenAt: string;
}

/**
 * What OneView can do with a session, from the Phase 0 spike:
 * - two-way: connector-managed session (approve + reply)
 * - approvals: existing Claude Code session via PermissionRequest hook
 * - observe: existing Codex desktop thread (stored state only)
 */
export type ControlLevel = "two-way" | "approvals" | "observe";

export type SessionStatus = "running" | "waiting" | "idle" | "ended";

export type Sandbox = "read-only" | "workspace-write" | "danger-full-access";

export interface AgentSession {
  id: string;
  provider: Provider;
  machineId: string;
  project: string;
  title: string;
  control: ControlLevel;
  status: SessionStatus;
  sandbox?: Sandbox;
  updatedAt: string;
}

export type RiskTag = "delete" | "git-push" | "network" | "outside-project";

export type ItemState = "open" | "answered" | "answered-elsewhere" | "expired";

interface InboxItemBase {
  id: string;
  sessionId: string;
  createdAt: string;
  state: ItemState;
}

export interface ApprovalItem extends InboxItemBase {
  kind: "approval";
  tool: string;
  /** Shell command, for command approvals. */
  command?: string;
  cwd: string;
  reason?: string;
  /** File edits show path + line counts only, never diffs. */
  filePath?: string;
  linesAdded?: number;
  linesRemoved?: number;
  risk: RiskTag[];
  /** When the laptop prompt takes over. */
  expiresAt: string;
}

export interface QuestionItem extends InboxItemBase {
  kind: "question";
  question: string;
  choices: string[];
  recommendation?: string;
}

export interface CompletionItem extends InboxItemBase {
  kind: "completion";
  summary: string;
}

export type InboxItem = ApprovalItem | QuestionItem | CompletionItem;

export type CommandKind = "approve" | "deny" | "reply";

export interface Command {
  /** Idempotency key: retries reuse it, so a command is never applied twice. */
  id: string;
  sessionId: string;
  itemId?: string;
  kind: CommandKind;
  text?: string;
  createdAt: string;
}

export type ReceiptStatus = "sending" | "queued" | "accepted" | "delivered" | "failed" | "expired";

export interface Receipt {
  commandId: string;
  status: ReceiptStatus;
  reason?: string;
  at: string;
}

export function canReply(s: AgentSession): boolean {
  return s.control === "two-way";
}

export function canApprove(s: AgentSession): boolean {
  return s.control === "two-way" || s.control === "approvals";
}

const RISK_PATTERNS: [RiskTag, RegExp][] = [
  ["delete", /\b(rm|del|rmdir|Remove-Item)\b/i],
  ["git-push", /\bgit\s+push\b/i],
  ["network", /\b(curl|wget|Invoke-WebRequest|npm\s+publish|ssh|scp)\b/i],
];

/** Highlights risky actions on the card. Never used to auto-approve anything. */
export function riskTags(command: string | undefined, cwd: string, project: string): RiskTag[] {
  const tags: RiskTag[] = [];
  if (command) for (const [tag, re] of RISK_PATTERNS) if (re.test(command)) tags.push(tag);
  if (!cwd.toLowerCase().includes(project.toLowerCase())) tags.push("outside-project");
  return tags;
}

export * from "./mock";
