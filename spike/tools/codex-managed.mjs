// Spike: connector-managed Codex session over app-server stdio.
// Usage: node codex-managed.mjs <codex.exe> <cwd> <accept|decline>
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const [codexBin, cwd, decision = "accept"] = process.argv.slice(2);
const logDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, "codex-managed.jsonl");
const log = (o) => {
  fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...o }) + "\n");
  console.log(JSON.stringify(o).slice(0, 300));
};

// CODEX_ARGS="app-server proxy" connects through the shared daemon instead of a private server.
const codexArgs = (process.env.CODEX_ARGS ?? "app-server").split(" ");
const observeOnly = process.env.OBSERVE_ONLY === "1";
const proc = spawn(codexBin, codexArgs, { stdio: ["pipe", "pipe", "inherit"] });
proc.on("exit", (code) => {
  for (const p of pending.values()) p.reject(new Error(`codex exited (${code}) during ${p.method}`));
  pending.clear();
});
let nextId = 1;
const pending = new Map();
const send = (msg) => proc.stdin.write(JSON.stringify(msg) + "\n");
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, method });
    send({ jsonrpc: "2.0", id, method, params });
  });

let turnDone;
const waitTurn = () => new Promise((r) => (turnDone = r));

readline.createInterface({ input: proc.stdout }).on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.id !== undefined && pending.has(msg.id) && !msg.method) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(`${p.method}: ${JSON.stringify(msg.error)}`)) : p.resolve(msg.result);
  } else if (msg.method && msg.id !== undefined) {
    // Server -> client request (approvals, user input).
    log({ kind: "serverRequest", method: msg.method, paramKeys: Object.keys(msg.params ?? {}), command: msg.params?.command, reason: msg.params?.reason });
    if (msg.method === "item/commandExecution/requestApproval" || msg.method === "item/fileChange/requestApproval") {
      send({ jsonrpc: "2.0", id: msg.id, result: { decision } });
      log({ kind: "answered", decision });
    } else {
      send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unsupported in spike" } });
    }
  } else if (msg.method) {
    if (/^(turn|thread|serverRequest)\//.test(msg.method)) log({ kind: "notification", method: msg.method, status: msg.params?.turn?.status });
    if (msg.method === "turn/completed") turnDone?.(msg.params);
  }
});

const timer = setTimeout(() => { log({ kind: "timeout" }); proc.kill(); process.exit(2); }, 240000);

try {
  const init = await request("initialize", { clientInfo: { name: "oneview-spike", version: "0.0.1" } });
  send({ jsonrpc: "2.0", method: "initialized" });
  log({ kind: "initialized", keys: Object.keys(init ?? {}) });

  // Passive visibility: what stored threads (incl. desktop ones) can a separate app-server see?
  const list = await request("thread/list", { limit: 5 });
  log({ kind: "thread/list", count: list.data?.length, sample: list.data?.map((t) => ({ id: t.id, source: t.source, status: t.status?.type ?? t.status })) });
  const loaded = await request("thread/loaded/list", {});
  log({ kind: "thread/loaded/list", result: loaded });
  if (observeOnly) throw new Error("observe-only run, stopping before thread/start");

  const started = await request("thread/start", { cwd, approvalPolicy: "untrusted", sandbox: "read-only", ephemeral: true });
  const threadId = started.thread?.id;
  log({ kind: "thread/start", threadId });

  let t = waitTurn();
  await request("turn/start", { threadId, input: [{ type: "text", text: "Run this exact shell command: echo oneview > codex.txt . Then reply with one short sentence." }] });
  log({ kind: "turn1/completed", status: (await t).turn?.status });

  t = waitTurn();
  await request("turn/start", { threadId, input: [{ type: "text", text: "Reply with exactly: oneview reply received" }] });
  log({ kind: "turn2/completed", status: (await t).turn?.status });
} catch (e) {
  log({ kind: "error", message: String(e.message).slice(0, 500) });
} finally {
  clearTimeout(timer);
  proc.kill();
  log({ kind: "fileCreated", exists: fs.existsSync(path.join(cwd, "codex.txt")) });
}
