# Phase 0 spike findings

Environment: Windows 11, Node 24.20.0. Claude Code 2.1.293 and codex-cli 0.162.0-alpha.2 are both bundled in their desktop apps and are not on PATH.
Raw logs stay in `spike/logs/`, which is gitignored.

## Codex

| Test | Result |
|---|---|
| Separate `app-server` (stdio) `thread/list` | **Pass.** It lists stored threads, including desktop ones (`source: vscode`), all with status `notLoaded`. |
| `thread/loaded/list` from a separate app-server | Empty. Desktop-loaded threads are **not** visible: there is no shared live state. |
| Connector-managed thread: `thread/start` + `turn/start` | **Pass.** |
| Approval relay: `item/commandExecution/requestApproval` → `{decision:"accept"}` | **Pass.** It is followed by `serverRequest/resolved` and `turn/completed`. The accepted command still runs inside the sandbox the client chose. |
| Approval relay: `decline` | **Pass.** Codex logs "rejected by user" and the turn continues. |
| Free-form follow-up reply (second `turn/start`) | **Pass.** |
| `app-server daemon start` (to share desktop sessions) | **Blocked.** The bundled CLI errors with "this CLI has no complete local package; install a packaged Codex CLI or use the standalone installer". Nothing changed: no `app-server-control/` dir was created and `config.toml` is unchanged. |

Approval request fields: `threadId, turnId, itemId, command, cwd, commandActions, proposedExecpolicyAmendment, availableDecisions`, which is enough for an approval card.
Decisions available: `accept`, `acceptForSession`, `acceptWithExecpolicyAmendment`, `applyNetworkPolicyAmendment`, `decline`, `cancel`. The MVP uses only `accept` / `decline` / `cancel`.

**Conclusion:** two-way control of Codex is proven for connector-managed threads. Desktop threads are read-only (stored-state polling) unless the standalone Codex CLI is installed and its daemon is shown to serve desktop threads (an open question that needs a separate install).

## Claude Code

| Test | Result |
|---|---|
| Hooks in the test project's `.claude/settings.json` load | **Pass.** |
| `SessionStart` payload | Contains `session_id, transcript_path, cwd, hook_event_name, source`. |
| `PermissionRequest` relay (allow / deny / 60 s timeout fallback) | **Pending.** The bundled CLI is not logged in standalone: the desktop app supplies auth to its own sessions. This needs a logged-in session (see below). |
