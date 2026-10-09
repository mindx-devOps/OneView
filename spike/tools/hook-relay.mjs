// Spike: Claude Code hook relay. Logs the hook event (redacted) and, for
// PermissionRequest, waits for a "phone" decision file before falling back.
// Decision file: spike/logs/decision.json  {"behavior":"allow"|"deny","message"?:string}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(here, "..", "logs");
fs.mkdirSync(logDir, { recursive: true });
const timeoutMs = Number(process.env.ONEVIEW_APPROVAL_TIMEOUT_MS ?? 60000);

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const log = (obj) =>
  fs.appendFileSync(path.join(logDir, "events.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...obj }) + "\n");

// Keep only what an inbox card would need.
const summary = {
  event: input.hook_event_name,
  session_id: input.session_id,
  cwd: input.cwd,
  permission_mode: input.permission_mode,
  tool_name: input.tool_name,
  tool_input: input.tool_input,
  notification_type: input.notification_type,
  message: input.message,
  keys: Object.keys(input),
};
log({ kind: "received", ...summary });

if (input.hook_event_name !== "PermissionRequest") process.exit(0);

const decisionFile = path.join(logDir, "decision.json");
const started = Date.now();
while (Date.now() - started < timeoutMs) {
  if (fs.existsSync(decisionFile)) {
    const decision = JSON.parse(fs.readFileSync(decisionFile, "utf8"));
    fs.rmSync(decisionFile);
    log({ kind: "decided", behavior: decision.behavior, waitedMs: Date.now() - started });
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PermissionRequest", decision },
      }),
    );
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 250));
}
// No answer from the phone: emit nothing so Claude Code shows its normal prompt.
log({ kind: "timeout", waitedMs: Date.now() - started });
process.exit(0);
