// OneView Android shell (Phase 1): mock data, shared protocol types, no backend.
import {
  PROVIDER_LABEL,
  canApprove,
  canReply,
  mockSnapshot,
  simulateSend,
  type AgentSession,
  type Command,
  type InboxItem,
  type Machine,
  type Receipt,
} from "@oneview/protocol";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";

type Screen = { name: "inbox" } | { name: "item"; itemId: string } | { name: "compose"; sessionId?: string };

interface Pending {
  session: AgentSession;
  item?: InboxItem;
  kind: Command["kind"];
  text: string;
}

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = dark ? darkColors : lightColors;
  const [snap, setSnap] = useState(() => mockSnapshot(Date.now()));
  const [connector, setConnector] = useState<Machine["connector"]>("online");
  const [screen, setScreen] = useState<Screen>({ name: "inbox" });
  const [pending, setPending] = useState<Pending | null>(null);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});

  const machine: Machine = { ...snap.machines[0]!, connector };
  const sessionOf = (id: string) => snap.sessions.find((s) => s.id === id);
  const open = useMemo(
    () =>
      snap.items
        .filter((i) => i.state === "open" && i.kind !== "completion")
        .sort((a, b) => Number(b.kind === "approval") - Number(a.kind === "approval")),
    [snap],
  );

  const send = (text: string) => {
    if (!pending) return;
    const key = pending.item?.id ?? pending.session.id;
    const cmd: Command = { id: `${Date.now()}-${Math.random()}`, sessionId: pending.session.id, itemId: pending.item?.id, kind: pending.kind, text: text.trim() || undefined, createdAt: new Date().toISOString() };
    const itemId = pending.item?.id;
    simulateSend(cmd, machine, pending.item, (r) => {
      setReceipts((p) => ({ ...p, [key]: r }));
      if (r.status === "delivered" && itemId) setSnap((s) => ({ ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, state: "answered" } : i)) }));
    });
    setPending(null);
  };

  const s = styles(c);
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={s.topbar}>
        <Text style={s.brand}>OneView</Text>
        <Pressable onPress={() => setConnector(connector === "online" ? "offline" : connector === "offline" ? "paused" : "online")} accessibilityLabel="Cycle connector state (prototype)">
          <Text style={[s.small, { color: connector === "online" ? c.ok : connector === "paused" ? c.warn : c.bad }]}>
            ● {machine.name} {connector}
          </Text>
        </Pressable>
      </View>

      {screen.name === "inbox" && (
        <FlatList
          data={open}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={<Text style={[s.muted, { textAlign: "center", marginTop: 40 }]}>You’re all caught up.</Text>}
          renderItem={({ item }) => {
            const ses = sessionOf(item.sessionId)!;
            return (
              <Pressable style={[s.card, item.kind === "approval" && s.approval]} onPress={() => setScreen({ name: "item", itemId: item.id })}>
                <SessionLine s={ses} c={c} />
                <Text style={s.title} numberOfLines={2}>
                  {item.kind === "approval" ? `Approve: ${item.command ?? item.filePath}` : item.kind === "question" ? item.question : item.summary}
                </Text>
                {receipts[item.id] && <Text style={s.small}>{receipts[item.id]!.status}</Text>}
              </Pressable>
            );
          }}
        />
      )}

      {screen.name === "item" && (() => {
        const item = snap.items.find((i) => i.id === screen.itemId)!;
        const ses = sessionOf(item.sessionId)!;
        const r = receipts[item.id];
        return (
          <View style={{ padding: 16, gap: 10 }}>
            <Pressable onPress={() => setScreen({ name: "inbox" })}><Text style={s.link}>← Inbox</Text></Pressable>
            <SessionLine s={ses} c={c} />
            {item.kind === "approval" && (
              <>
                <Text style={s.title}>Permission request · {item.tool}</Text>
                <Text style={s.code}>{item.command ?? `${item.filePath}  +${item.linesAdded} −${item.linesRemoved}`}</Text>
                <Text style={s.muted}>in {item.cwd}</Text>
                {ses.sandbox && <Text style={s.muted}>Sandbox: {ses.sandbox} (approving does not change it)</Text>}
                {item.risk.length > 0 && <Text style={{ color: c.bad }}>⚠ {item.risk.join(", ")}</Text>}
                {item.state === "open" && canApprove(ses) && !r && (
                  <View style={s.row}>
                    <Btn c={c} primary label="Allow once" onPress={() => setPending({ session: ses, item, kind: "approve", text: "" })} />
                    <Btn c={c} label="Deny" onPress={() => setPending({ session: ses, item, kind: "deny", text: "" })} />
                  </View>
                )}
              </>
            )}
            {item.kind === "question" && (
              <>
                <Text style={s.title}>{item.question}</Text>
                {item.state === "open" && canReply(ses) && !r && (
                  <View style={{ gap: 8 }}>
                    {item.choices.map((ch) => (
                      <Btn key={ch} c={c} primary={ch === item.recommendation} label={ch + (ch === item.recommendation ? " · recommended" : "")} onPress={() => setPending({ session: ses, item, kind: "reply", text: ch })} />
                    ))}
                    <Btn c={c} label="Speak or type a reply…" onPress={() => setScreen({ name: "compose", sessionId: ses.id })} />
                  </View>
                )}
              </>
            )}
            {r && <Text style={s.small}>{r.status}{r.reason ? ` · ${r.reason}` : ""}</Text>}
          </View>
        );
      })()}

      {screen.name === "compose" && (
        <Composer
          c={c}
          sessions={snap.sessions.filter(canReply)}
          initialSessionId={screen.sessionId}
          onBack={() => setScreen({ name: "inbox" })}
          onReview={(session, text) => setPending({ session, kind: "reply", text })}
          receipt={(id) => receipts[id]}
        />
      )}

      {screen.name === "inbox" && (
        <Pressable style={s.fab} onPress={() => setScreen({ name: "compose" })} accessibilityLabel="New voice reply">
          <Text style={{ color: c.accentText, fontWeight: "700" }}>🎙 Reply</Text>
        </Pressable>
      )}

      <ConfirmSheet c={c} pending={pending} machine={machine} onCancel={() => setPending(null)} onSend={send} />
    </SafeAreaView>
  );
}

function Composer(props: {
  c: Colors;
  sessions: AgentSession[];
  initialSessionId?: string;
  onBack: () => void;
  onReview: (s: AgentSession, text: string) => void;
  receipt: (id: string) => Receipt | undefined;
}) {
  const { c } = props;
  const s = styles(c);
  // Target must be picked explicitly. No default unless the user came from a specific session.
  const [target, setTarget] = useState<string | undefined>(props.initialSessionId);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const session = props.sessions.find((x) => x.id === target);

  return (
    <View style={{ padding: 16, gap: 10, flex: 1 }}>
      <Pressable onPress={props.onBack}><Text style={s.link}>← Inbox</Text></Pressable>
      <Text style={s.muted}>Send to</Text>
      <View style={{ gap: 6 }}>
        {props.sessions.map((x) => (
          <Pressable key={x.id} onPress={() => setTarget(x.id)} style={[s.card, target === x.id && { borderColor: c.accent, borderWidth: 2 }]}>
            <SessionLine s={x} c={c} />
            <Text style={s.small}>{x.title}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPressIn={() => setListening(true)}
        onPressOut={() => {
          setListening(false);
          // Phase 1 mock: real on-device speech recognition arrives in Phase 4. No audio leaves the device.
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setText((t) => (t ? t + " " : "") + "Show a warning instead of blocking checkout."), 300);
        }}
        style={[s.ptt, listening && { backgroundColor: c.bad }]}
        accessibilityLabel="Hold to talk"
      >
        <Text style={{ color: c.accentText, fontWeight: "700" }}>{listening ? "Listening… release to stop" : "Hold to talk"}</Text>
      </Pressable>
      <TextInput value={text} onChangeText={setText} multiline placeholder="Transcript appears here. Edit before sending." placeholderTextColor={c.muted} style={s.input} />
      <Btn c={c} primary label={session ? "Review & send" : "Pick a session first"} disabled={!session || !text.trim()} onPress={() => session && props.onReview(session, text)} />
      {session && props.receipt(session.id) && <Text style={s.small}>{props.receipt(session.id)!.status}</Text>}
    </View>
  );
}

function ConfirmSheet({ c, pending, machine, onCancel, onSend }: { c: Colors; pending: Pending | null; machine: Machine; onCancel: () => void; onSend: (t: string) => void }) {
  const s = styles(c);
  const [text, setText] = useState("");
  const [shownFor, setShownFor] = useState<Pending | null>(null);
  if (pending !== shownFor) {
    setShownFor(pending);
    setText(pending?.text ?? "");
  }
  if (!pending) return null;
  const verb = pending.kind === "approve" ? "Allow once" : pending.kind === "deny" ? "Deny" : "Send reply";
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.muted}>Sending to</Text>
          <SessionLine s={pending.session} c={c} />
          <Text style={s.small}>{pending.session.title} · on {machine.name}</Text>
          {pending.kind !== "approve" && <TextInput value={text} onChangeText={setText} multiline style={s.input} />}
          {machine.connector !== "online" && <Text style={{ color: c.warn }}>Laptop is {machine.connector}. This will not be delivered right away.</Text>}
          <View style={s.row}>
            <Btn c={c} primary label={verb} disabled={pending.kind === "reply" && !text.trim()} onPress={() => onSend(text)} />
            <Btn c={c} label="Cancel" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SessionLine({ s: ses, c }: { s: AgentSession; c: Colors }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <Text style={{ color: ses.provider === "codex" ? c.text : c.claude, fontSize: 12, fontWeight: "700" }}>{PROVIDER_LABEL[ses.provider]}</Text>
      <Text style={{ color: c.text, fontWeight: "600" }}>{ses.project}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{ses.control === "two-way" ? "approve + reply" : ses.control === "approvals" ? "approvals only" : "view only"}</Text>
    </View>
  );
}

function Btn({ c, label, onPress, primary, disabled }: { c: Colors; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", borderWidth: 1, borderColor: primary ? c.accent : c.border, backgroundColor: primary ? c.accent : c.surface, opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: primary ? c.accentText : c.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const lightColors = { bg: "#f6f6f4", surface: "#ffffff", text: "#1c1c1a", muted: "#6b6b66", border: "#e2e2dd", accent: "#2f5bd3", accentText: "#ffffff", ok: "#1f7a4d", warn: "#9a6400", bad: "#b3261e", claude: "#c2622d", code: "#f0f0ec" };
const darkColors: Colors = { bg: "#141413", surface: "#1e1e1c", text: "#ececea", muted: "#a3a39d", border: "#33332f", accent: "#7c9bff", accentText: "#0e1220", ok: "#5cc48e", warn: "#e0b04a", bad: "#ff8a80", claude: "#e08a5a", code: "#262624" };
type Colors = typeof lightColors;

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, paddingTop: 28 },
    topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border },
    brand: { color: c.text, fontWeight: "700", fontSize: 18 },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, gap: 4 },
    approval: { borderLeftWidth: 4, borderLeftColor: c.accent },
    title: { color: c.text, fontWeight: "600", fontSize: 15 },
    muted: { color: c.muted },
    small: { color: c.muted, fontSize: 12 },
    link: { color: c.accent },
    code: { fontFamily: "monospace", backgroundColor: c.code, color: c.text, padding: 8, borderRadius: 8 },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, minHeight: 70, color: c.text, backgroundColor: c.surface, textAlignVertical: "top" },
    fab: { position: "absolute", right: 20, bottom: 30, backgroundColor: c.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999 },
    ptt: { backgroundColor: c.accent, borderRadius: 999, paddingVertical: 18, alignItems: "center" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, padding: 16, gap: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  });
