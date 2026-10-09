# OneView Implementation Plan

## Product
OneView is a voice-first shared inbox for coding-agent sessions on the user's laptop. Initial targets: responsive web app and Android app. Initial providers: Claude Code and Codex.

## Delivery rule
Build in small, reviewable milestones. Begin by inspecting this folder and recording its current state. Do not overwrite existing files. Do not install dependencies or change global Claude/Codex configuration without presenting the exact change first. First prove the local integrations on the user's installed versions.

## Decisions (2026-10-09)
- **Inbox storage:** plaintext with a short retention TTL (no E2E encryption in MVP). Store only question text, choices, and routing metadata; purge resolved/expired items on TTL.
- **Hero feature:** remote approve/deny of permission prompts. Free-form replies are secondary.
- **Voice:** text-first on web; push-to-talk voice ships on Android first (on-device recognition where available). Web voice comes later behind explicit consent.
- **Queued commands expire:** a reply/approval that cannot reach the laptop within ~15 min is marked expired, never delivered late.
- **Send confirmation reads back the target** (provider · project · session) before Send.

## Preliminary capability matrix (from initial inspection; Phase 0 must confirm)
Environment: Windows 11, Claude Code 2.1.293 and codex-cli 0.162.0-alpha.2, both bundled in their desktop apps and not on PATH.

| Provider / session | Observe | Approve permission | Free-form reply |
|---|---|---|---|
| Claude Code, existing session | Yes, via hooks (`Notification`, `Stop`, `PermissionRequest`, `SessionStart`/`SessionEnd`) | Likely, via a `PermissionRequest` hook that waits on the phone's decision, with a timeout that falls back to the local prompt | No real user message. A `Stop` hook with `decision: block` is a workaround only. |
| Claude Code, connector-managed | Yes | Yes (Agent SDK `canUseTool`) | Yes |
| Codex desktop, existing thread | Stored state only (`thread/list`, `thread/read`) | Unknown: run the daemon `enable-remote-control` test | Unknown: same test |
| Codex, connector-managed app-server | Yes, full events | Yes (server-to-client approval requests) | Yes (`turn/start`, `turn/steer`) |

Notes: Codex desktop owns its app-server over private stdio, and no shared control socket was running. The existing `notify` entry in `~/.codex/config.toml` belongs to Codex computer-use and must not be replaced.

## Phase 0: Integration spike
1. Record OS, installed Claude Code and Codex versions, and how each is currently launched.
2. Read the current official Claude Code hooks guide and Codex app-server docs.
3. For Claude Code, prove whether lifecycle hooks can report session identity, status, questions, and completion to a local process. Separately prove whether a confirmed remote reply can be delivered to an already-running session.
4. For Codex, prototype the app-server against the installed version. Verify thread listing/resume/events and how replies to user-input requests work. Do not assume it attaches to the existing Codex desktop session.
5. Produce a compatibility matrix: observe existing / reply to existing / launch managed / offline behavior. Stop and report findings before broad implementation.
6. If existing-session reply is unsupported, keep passive visibility for those sessions and offer explicitly connector-managed sessions for two-way control. Never inject keystrokes or take over terminals silently.

## Phase 1: UX prototype with mock events
Create a responsive web inbox and Android shell using shared TypeScript types. Screens: sign-in/pairing placeholder, inbox, session list, session detail, question card, voice composer, connection settings. Populate deterministic mock Claude and Codex sessions. No backend or real agent control yet.

Primary question flow: show provider, project, session, question, choices and recommendation; user selects or speaks a reply; transcript and target are visible; user explicitly sends; UI displays accepted/delivered/failed receipt. Include connection status, empty, loading, error, and offline states.

## Phase 2: Service and pairing
Use a TypeScript monorepo. Suggested packages: apps/web (Next.js), apps/android (Expo React Native), apps/api (Fastify or equivalent), apps/connector (Node.js), packages/protocol (shared schemas/types). Select one package manager and pin versions. Use managed auth, PostgreSQL, and realtime delivery (Supabase is an MVP candidate). Keep provider adapters independent of UI and transport.

Tables/entities: users, devices, machines, agent_sessions, inbox_items, commands, receipts. Include ownership on all user data, unique provider event IDs, idempotency keys, timestamps, and explicit status enums. Set row-level access policies. Pair Android/laptop with short-lived, single-use QR tokens; allow device revocation.

Connector opens an outbound TLS WebSocket to the service; never expose an inbound laptop port. Authenticate with a revocable device token stored in OS credential storage. Add heartbeat, reconnect backoff, duplicate-event suppression, command acknowledgments, and bounded local queue. Commands must target an explicitly selected session and require a user action.

## Phase 3: Agent adapters
Normalize provider events into AgentSessionEvent, InboxItem, and CommandReceipt. Preserve raw provider payloads locally only for bounded diagnostic logs; do not upload them by default.

Claude adapter: consume only the minimum lifecycle hook output needed. Make hook installation opt-in, show exact settings changes, and provide uninstall/rollback. Prove safe reply behavior before claiming remote control.

Codex adapter: use the verified app-server path for managed threads and supported events. Keep protocol/version checks visible. Avoid depending on undocumented private rollout formats or credentials. Never read or transmit agent credentials.

## Phase 4: Voice and Android notifications
Voice v1 is push-to-talk speech-to-text, not always-on listening. Show editable transcript, selected provider/session, and explicit Send. Use OS/browser speech recognition when available; offer text fallback. If server transcription is later needed, request consent before audio leaves the device and do not retain audio.

Android receives notifications for questions and completion; tapping opens the exact item. Add notification permission onboarding at the moment the user enables notifications. Keep Android UI functional when notifications are denied.

## Phase 5: hardening
Cover laptop sleep/offline, stale questions, connector restarts, duplicate events, expired pair codes, lost network, failed delivery, provider upgrades, revoked devices, and privacy controls. Show laptop last-seen time and which sessions remain reachable. Provide pause/stop and disconnect controls.

## MVP acceptance criteria
- Claude Code and Codex are visibly distinct providers.
- Inbox identifies machine, project, and session.
- Web and Android show the same current inbox state.
- User can send a reviewed text or voice-transcribed reply to a verified supported session.
- Every command has an observable receipt or failure reason.
- Duplicate events do not duplicate inbox items; retry does not send a command twice.
- Offline laptop state is clear and local-session commands are not falsely reported as delivered.
- No automatic agent routing or sending; no source file, screenshot, API key, audio, or full conversation upload by default.

## Claude Code working protocol
Before each phase: inspect repository and instructions, explain planned files and risks, then implement only that phase. Keep changes small and summarize modified files and manual verification steps. Do not run tests unless requested. Never modify global agent settings or install software without showing the exact command and receiving approval.
