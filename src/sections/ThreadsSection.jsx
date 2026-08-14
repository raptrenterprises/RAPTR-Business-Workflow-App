import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, X, Eye, ChevronDown, ChevronUp, CheckCircle2, RotateCcw, Send, CalendarDays } from "lucide-react";
import { STYLES, IMPORTANCE_WEIGHT, URGENCY_WEIGHT, uid, importanceColor, urgencyColor, selectStyle } from "../constants";
import { ImportanceSelect, UrgencySelect, Badge, Legend, SortFilterBar, CenterMsg, EmptyMsg, ErrorBar } from "../components/Shared";
import { fetchThreads, insertThread, updateThread, deleteThreadRow, subscribeThreads } from "../lib/threadsApi";

const emptyThreadDraft = (users, currentUser) => ({ title: "", body: "", to: users.find((u) => u !== currentUser) || users[0], importance: "Medium", urgency: "Medium", dueDate: "" });

export default function ThreadsSection({ currentUser, users }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyThreadDraft(users, currentUser));
  const [composing, setComposing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [minImportance, setMinImportance] = useState("Any");
  const [minUrgency, setMinUrgency] = useState("Any");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setThreads(await fetchThreads()); } catch (e) { setError("Couldn't load threads: " + e.message); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const unsubscribe = subscribeThreads(() => reload());
    return unsubscribe;
  }, [reload]);

  async function sendThread() {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) return;
    const thread = {
      id: uid(), title, participants: [currentUser, draft.to], createdBy: currentUser, createdAt: new Date().toISOString(),
      importance: draft.importance, urgency: draft.urgency, status: "active", turn: draft.to, seenBy: [currentUser],
      completedAt: null, dueDate: draft.dueDate || null, messages: [{ id: uid(), from: currentUser, body, at: new Date().toISOString() }],
    };
    setDraft(emptyThreadDraft(users, currentUser));
    setComposing(false);
    try { await insertThread(thread); setExpandedId(thread.id); reload(); } catch (e) { setError("Couldn't send thread: " + e.message); }
  }

  async function reply(threadId) {
    const text = replyText.trim();
    if (!text) return;
    const th = threads.find((t) => t.id === threadId);
    if (!th) return;
    const other = th.participants.find((p) => p !== currentUser) || th.participants[0];
    const newMessages = [...th.messages, { id: uid(), from: currentUser, body: text, at: new Date().toISOString() }];
    setReplyText("");
    try { await updateThread(threadId, { status: "active", turn: other, seenBy: [currentUser], messages: newMessages }); reload(); } catch (e) { setError("Couldn't send reply: " + e.message); }
  }

  async function toggleSeen(threadId) {
    const th = threads.find((t) => t.id === threadId);
    if (!th) return;
    const seen = th.seenBy.includes(currentUser);
    const nextSeenBy = seen ? th.seenBy.filter((u) => u !== currentUser) : [...th.seenBy, currentUser];
    try { await updateThread(threadId, { seenBy: nextSeenBy }); reload(); } catch (e) { setError("Couldn't update seen status: " + e.message); }
  }

  async function markComplete(threadId) {
    try { await updateThread(threadId, { status: "complete", completedAt: new Date().toISOString() }); reload(); } catch (e) { setError("Couldn't mark complete: " + e.message); }
  }

  async function reopenThread(threadId) {
    const th = threads.find((t) => t.id === threadId);
    if (!th) return;
    const last = th.messages[th.messages.length - 1];
    const other = th.participants.find((p) => p !== last.from) || th.participants[0];
    try { await updateThread(threadId, { status: "active", completedAt: null, turn: other }); reload(); } catch (e) { setError("Couldn't reopen thread: " + e.message); }
  }

  async function updateLevel(threadId, field, value) {
    try { await updateThread(threadId, { [field]: value }); reload(); } catch (e) { setError("Couldn't update: " + e.message); }
  }

  async function updateDueDate(threadId, value) {
    try { await updateThread(threadId, { dueDate: value || null }); reload(); } catch (e) { setError("Couldn't update due date: " + e.message); }
  }

  async function deleteThread(threadId) {
    try { await deleteThreadRow(threadId); if (expandedId === threadId) setExpandedId(null); reload(); } catch (e) { setError("Couldn't delete thread: " + e.message); }
  }

  const visibleThreads = useMemo(() => {
    let list = [...threads];
    if (minImportance !== "Any") list = list.filter((t) => IMPORTANCE_WEIGHT[t.importance] >= IMPORTANCE_WEIGHT[minImportance]);
    if (minUrgency !== "Any") list = list.filter((t) => URGENCY_WEIGHT[t.urgency] >= URGENCY_WEIGHT[minUrgency]);
    const score = (t) => IMPORTANCE_WEIGHT[t.importance] + URGENCY_WEIGHT[t.urgency];
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === "complete" ? 1 : -1;
      if (a.status === "active") {
        const aTurn = a.turn === currentUser ? 0 : 1;
        const bTurn = b.turn === currentUser ? 0 : 1;
        if (aTurn !== bTurn) return aTurn - bTurn;
      }
      switch (sortBy) {
        case "urgency": return URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency];
        case "importance": return IMPORTANCE_WEIGHT[b.importance] - IMPORTANCE_WEIGHT[a.importance];
        case "newest": return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest": return new Date(a.createdAt) - new Date(b.createdAt);
        default: return score(b) - score(a);
      }
    });
    return list;
  }, [threads, sortBy, minImportance, minUrgency, currentUser]);

  if (loading) return <CenterMsg>Loading threads…</CenterMsg>;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px" }}>
        {composing ? (
          <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14, marginBottom: 20 }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Subject…" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 15, marginBottom: 8 }} />
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Your message or question…" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14, marginBottom: 10, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                To
                <select value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} style={selectStyle()}>
                  {users.filter((u) => u !== currentUser).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <ImportanceSelect value={draft.importance} onChange={(v) => setDraft({ ...draft, importance: v })} />
              <UrgencySelect value={draft.urgency} onChange={(v) => setDraft({ ...draft, urgency: v })} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                Due <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} style={selectStyle()} />
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={sendThread} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}><Send size={15} /> Send</button>
                <button onClick={() => { setComposing(false); setDraft(emptyThreadDraft(users, currentUser)); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "9px 12px", cursor: "pointer" }}><X size={15} /></button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setComposing(true)} style={{ width: "100%", background: "#fff", border: `1px dashed ${STYLES.brass}`, borderRadius: 6, padding: "14px", cursor: "pointer", color: STYLES.slate, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
            <Plus size={16} /> Start a new thread
          </button>
        )}

        <Legend />
        <SortFilterBar sortBy={sortBy} setSortBy={setSortBy} minImportance={minImportance} setMinImportance={setMinImportance} minUrgency={minUrgency} setMinUrgency={setMinUrgency} />

        {visibleThreads.length === 0 ? (
          <EmptyMsg>No threads match here yet.</EmptyMsg>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {visibleThreads.map((th) => {
              const isExpanded = expandedId === th.id;
              const isComplete = th.status === "complete";
              const yourTurn = !isComplete && th.turn === currentUser;
              const seen = th.seenBy.includes(currentUser);
              const other = th.participants.find((p) => p !== currentUser) || th.participants[0];

              return (
                <li key={th.id} style={{ background: "#fff", border: `1px solid ${yourTurn ? STYLES.wax + "88" : STYLES.ink + "1a"}`, borderRadius: 6, opacity: isComplete ? 0.6 : 1, overflow: "hidden" }}>
                  <div onClick={() => setExpandedId(isExpanded ? null : th.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", flexWrap: "wrap" }}>
                    <span style={{ flex: 1, minWidth: 140, fontSize: 15, fontWeight: 600 }}>{th.title}</span>
                    <StatusPill isComplete={isComplete} yourTurn={yourTurn} other={other} />
                    <Badge label={`I: ${th.importance}`} color={importanceColor(th.importance)} />
                    <Badge label={`U: ${th.urgency}`} color={urgencyColor(th.urgency)} />
                    {th.dueDate && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: STYLES.slate, background: STYLES.ink + "0d", padding: "2px 8px", borderRadius: 10 }}><CalendarDays size={11} /> {th.dueDate}</span>}
                    <button onClick={(e) => { e.stopPropagation(); toggleSeen(th.id); }} title={seen ? "Seen — click to mark unseen" : "Not yet seen — click to mark seen"} style={{ background: seen ? STYLES.brass + "22" : STYLES.wax + "1a", border: `1px solid ${seen ? STYLES.brass : STYLES.wax}55`, borderRadius: 10, padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: seen ? STYLES.brass : STYLES.wax }}>
                      <Eye size={11} /> {seen ? "Seen" : "Unseen"}
                    </button>
                    {isExpanded ? <ChevronUp size={16} color={STYLES.slate} /> : <ChevronDown size={16} color={STYLES.slate} />}
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${STYLES.ink}14`, padding: 14 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                        <ImportanceSelect value={th.importance} onChange={(v) => updateLevel(th.id, "importance", v)} />
                        <UrgencySelect value={th.urgency} onChange={(v) => updateLevel(th.id, "urgency", v)} />
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                          Due <input type="date" value={th.dueDate || ""} onChange={(e) => updateDueDate(th.id, e.target.value)} style={selectStyle()} />
                        </label>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {th.messages.map((m) => (
                          <div key={m.id} style={{ alignSelf: m.from === currentUser ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                            <div style={{ fontSize: 11, color: STYLES.slate, marginBottom: 2, textAlign: m.from === currentUser ? "right" : "left" }}>
                              {m.from} · {new Date(m.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div style={{ background: m.from === currentUser ? STYLES.brass + "22" : STYLES.ink + "0d", border: `1px solid ${STYLES.ink}14`, borderRadius: 8, padding: "8px 12px", fontSize: 14 }}>{m.body}</div>
                          </div>
                        ))}
                      </div>
                      {!isComplete ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <textarea value={expandedId === th.id ? replyText : ""} onChange={(e) => setReplyText(e.target.value)} placeholder={`Reply to ${other}…`} rows={2} style={{ flex: 1, boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <button onClick={() => reply(th.id)} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><Send size={13} /> Reply</button>
                            <button onClick={() => markComplete(th.id)} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><CheckCircle2 size={13} /> Complete</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: STYLES.slate }}>Closed {th.completedAt ? new Date(th.completedAt).toLocaleDateString() : ""} — archived.</span>
                          <button onClick={() => reopenThread(th.id)} style={{ background: "transparent", border: `1px solid ${STYLES.brass}`, color: STYLES.brass, borderRadius: 4, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><RotateCcw size={12} /> Reopen</button>
                          <button onClick={() => deleteThread(th.id)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate }}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

function StatusPill({ isComplete, yourTurn, other }) {
  if (isComplete) return <span style={{ fontSize: 11, fontWeight: 600, color: STYLES.slate, background: STYLES.ink + "0d", padding: "3px 9px", borderRadius: 10 }}>Complete</span>;
  if (yourTurn) return <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: STYLES.wax, padding: "3px 9px", borderRadius: 10 }}>Open for you</span>;
  return <span style={{ fontSize: 11, fontWeight: 600, color: STYLES.brass, background: STYLES.brass + "1a", padding: "3px 9px", borderRadius: 10 }}>Waiting on {other}</span>;
}
