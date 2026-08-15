import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, Plus, Trash2, Users, User, X, Pencil, Save, Repeat, CalendarDays, ListChecks, SlidersHorizontal } from "lucide-react";
import {
  STYLES, IMPORTANCE_WEIGHT, URGENCY_WEIGHT, RECURRENCE_OPTIONS, priorityRank, effectiveUrgency,
  uid, todayStr, advanceDate, importanceColor, urgencyColor, selectStyle,
} from "../constants";
import { TabButton, ImportanceSelect, UrgencyOrDueDateField, Badge, Legend, SortFilterBar, CenterMsg, EmptyMsg, ErrorBar } from "../components/Shared";
import { fetchTasks, insertTask, updateTask, deleteTaskRow, subscribeTasks } from "../lib/tasksApi";

const emptyTaskDraft = () => ({ title: "", importance: "Medium", urgency: "Medium", urgencyMode: "urgency", dueDate: "", recurrence: "none", owner: "shared" });

export default function TasksSection({ currentUser, users }) {
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState(currentUser);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState(emptyTaskDraft());
  const [sortBy, setSortBy] = useState("priority");
  const [minImportance, setMinImportance] = useState("Any");
  const [minUrgency, setMinUrgency] = useState("Any");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setTasks(await fetchTasks()); } catch (e) { setError("Couldn't load tasks: " + e.message); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const unsubscribe = subscribeTasks(() => reload());
    return unsubscribe;
  }, [reload]);

  async function addTask() {
    const title = draft.title.trim();
    if (!title) return;
    const owner = tab === "all" ? draft.owner : tab;
    const usingDueDate = draft.urgencyMode === "dueDate" && draft.dueDate;
    const task = {
      id: uid(), title, owner, completed: false, createdBy: currentUser, createdAt: new Date().toISOString(),
      importance: draft.importance,
      urgency: usingDueDate ? null : draft.urgency,
      dueDate: usingDueDate ? draft.dueDate : null,
      recurrence: draft.recurrence,
    };
    setDraft({ ...emptyTaskDraft(), owner: draft.owner });
    setComposing(false);
    try { await insertTask(task); reload(); } catch (e) { setError("Couldn't add task: " + e.message); }
  }

  async function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    try {
      if (!task.completed && task.recurrence && task.recurrence !== "none") {
        const nextDue = task.dueDate ? advanceDate(task.dueDate, task.recurrence) : null;
        const nextTask = { ...task, id: uid(), completed: false, createdAt: new Date().toISOString(), dueDate: nextDue };
        await updateTask(id, { completed: true });
        await insertTask(nextTask);
      } else {
        await updateTask(id, { completed: !task.completed });
      }
      reload();
    } catch (e) { setError("Couldn't update task: " + e.message); }
  }

  async function deleteTask(id) {
    try { await deleteTaskRow(id); if (editingId === id) setEditingId(null); reload(); } catch (e) { setError("Couldn't delete task: " + e.message); }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditDraft({
      title: task.title, owner: task.owner, importance: task.importance,
      urgency: task.urgency || "Medium",
      urgencyMode: task.dueDate ? "dueDate" : "urgency",
      dueDate: task.dueDate || "",
      recurrence: task.recurrence || "none",
    });
  }

  async function saveEdit(id) {
    const title = editDraft.title.trim();
    if (!title) return;
    const usingDueDate = editDraft.urgencyMode === "dueDate" && editDraft.dueDate;
    try {
      await updateTask(id, {
        title, owner: editDraft.owner, importance: editDraft.importance,
        urgency: usingDueDate ? null : editDraft.urgency,
        dueDate: usingDueDate ? editDraft.dueDate : null,
        recurrence: editDraft.recurrence,
      });
      setEditingId(null); setEditDraft(null); reload();
    } catch (e) { setError("Couldn't save changes: " + e.message); }
  }

  const visibleTasks = useMemo(() => {
    let list = tab === "all" ? [...tasks] : tasks.filter((t) => t.owner === tab);
    if (minImportance !== "Any") list = list.filter((t) => IMPORTANCE_WEIGHT[t.importance] >= IMPORTANCE_WEIGHT[minImportance]);
    if (minUrgency !== "Any") list = list.filter((t) => URGENCY_WEIGHT[effectiveUrgency(t)] >= URGENCY_WEIGHT[minUrgency]);
    const score = (t) => -priorityRank(effectiveUrgency(t), t.importance); // higher score = higher priority
    list.sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      switch (sortBy) {
        case "urgency": return URGENCY_WEIGHT[effectiveUrgency(b)] - URGENCY_WEIGHT[effectiveUrgency(a)];
        case "importance": return IMPORTANCE_WEIGHT[b.importance] - IMPORTANCE_WEIGHT[a.importance];
        case "dueDate":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        case "newest": return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest": return new Date(a.createdAt) - new Date(b.createdAt);
        default: return score(b) - score(a);
      }
    });
    return list;
  }, [tasks, tab, sortBy, minImportance, minUrgency]);

  if (loading) return <CenterMsg>Loading the case file…</CenterMsg>;

  const otherUsers = users.filter((u) => u !== currentUser);
  const tabs = [currentUser, "shared", ...otherUsers, "all"];
  const tabLabel = (t) => (t === "all" ? "All Tasks" : t === "shared" ? "Shared" : t);
  const tabIcon = (t) => (t === "all" ? <ListChecks size={15} /> : t === "shared" ? <Users size={15} /> : <User size={15} />);

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <div style={{ display: "flex", borderBottom: `1px solid ${STYLES.ink}22`, background: "#EAE3D1", overflowX: "auto" }}>
        {tabs.map((t) => <TabButton key={t} active={tab === t} onClick={() => setTab(t)} icon={tabIcon(t)} label={tabLabel(t)} />)}
      </div>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px" }}>
        {composing ? (
          <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14, marginBottom: 20 }}>
            <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder={tab === "all" ? "Add a task…" : tab === "shared" ? "Add a business task…" : `Add a task for ${tab}…`} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 15, marginBottom: 10 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {tab === "all" && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                  For
                  <select value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} style={selectStyle()}>
                    <option value="shared">Shared</option>
                    {users.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              )}
              <UrgencyOrDueDateField
                mode={draft.urgencyMode} setMode={(m) => setDraft({ ...draft, urgencyMode: m })}
                urgency={draft.urgency} setUrgency={(v) => setDraft({ ...draft, urgency: v })}
                dueDate={draft.dueDate} setDueDate={(v) => setDraft({ ...draft, dueDate: v })}
              />
              <ImportanceSelect value={draft.importance} onChange={(v) => setDraft({ ...draft, importance: v })} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                Repeats
                <select value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })} style={selectStyle()}>
                  {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={addTask} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <Plus size={16} /> Add
                </button>
                <button onClick={() => setComposing(false)} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "9px 12px", cursor: "pointer" }}><X size={15} /></button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setComposing(true)} style={{ width: "100%", background: "#fff", border: `1px dashed ${STYLES.brass}`, borderRadius: 6, padding: "14px", cursor: "pointer", color: STYLES.slate, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
            <Plus size={16} /> {tab === "all" ? "Add a task" : tab === "shared" ? "Add a business task" : `Add a task for ${tab}`}
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showFilters ? 8 : 16 }}>
          <Legend />
          <button onClick={() => setShowFilters((s) => !s)} title="Sort & filter" style={{ ...selectStyle(), display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: showFilters ? STYLES.ink : STYLES.slate, background: showFilters ? STYLES.brass + "33" : "#fff" }}>
            <SlidersHorizontal size={13} /> Sort & filter
          </button>
        </div>
        {showFilters && (
          <SortFilterBar sortBy={sortBy} setSortBy={setSortBy} minImportance={minImportance} setMinImportance={setMinImportance} minUrgency={minUrgency} setMinUrgency={setMinUrgency} extraSort={<option value="dueDate">Due date</option>} />
        )}

        {visibleTasks.length === 0 ? (
          <EmptyMsg>No tasks match here yet.</EmptyMsg>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleTasks.map((t) => {
              const isEditing = editingId === t.id;
              const overdue = t.dueDate && !t.completed && t.dueDate < todayStr();
              const urg = effectiveUrgency(t);
              if (isEditing) {
                return (
                  <li key={t.id} style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 4, padding: 14 }}>
                    <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 15, marginBottom: 10 }} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                        For
                        <select value={editDraft.owner} onChange={(e) => setEditDraft({ ...editDraft, owner: e.target.value })} style={selectStyle()}>
                          <option value="shared">Shared</option>
                          {users.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </label>
                      <UrgencyOrDueDateField
                        mode={editDraft.urgencyMode} setMode={(m) => setEditDraft({ ...editDraft, urgencyMode: m })}
                        urgency={editDraft.urgency} setUrgency={(v) => setEditDraft({ ...editDraft, urgency: v })}
                        dueDate={editDraft.dueDate} setDueDate={(v) => setEditDraft({ ...editDraft, dueDate: v })}
                      />
                      <ImportanceSelect value={editDraft.importance} onChange={(v) => setEditDraft({ ...editDraft, importance: v })} />
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                        Repeats
                        <select value={editDraft.recurrence} onChange={(e) => setEditDraft({ ...editDraft, recurrence: e.target.value })} style={selectStyle()}>
                          {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </label>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button onClick={() => saveEdit(t.id)} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><Save size={14} /> Save</button>
                        <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}><X size={14} /></button>
                      </div>
                    </div>
                  </li>
                );
              }
              return (
                <li key={t.id} style={{ display: "flex", flexDirection: "column", gap: 8, background: "#fff", border: `1px solid ${overdue ? STYLES.wax + "66" : STYLES.ink + "1a"}`, borderRadius: 4, padding: "12px 14px", opacity: t.completed ? 0.55 : 1 }}>
                  {/* Top row: checkbox + title (left) — urgency/importance badges (top-right) */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <button onClick={() => toggleTask(t.id)} aria-label={t.completed ? "Mark incomplete" : "Mark complete"} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${t.completed ? STYLES.brass : STYLES.slate}`, background: t.completed ? STYLES.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        {t.completed && <Check size={13} color="#fff" />}
                      </button>
                      <span style={{ fontSize: 15, textDecoration: t.completed ? "line-through" : "none", overflowWrap: "anywhere" }}>{t.title}</span>
                      {tab === "all" && <span style={{ fontSize: 11, color: STYLES.ink, background: STYLES.brass + "33", padding: "2px 8px", borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>{t.owner === "shared" ? "Shared" : t.owner}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Badge label={`U: ${urg}`} color={urgencyColor(urg)} />
                      <Badge label={`I: ${t.importance}`} color={importanceColor(t.importance)} />
                    </div>
                  </div>

                  {/* Bottom row: due date + recurrence + added-by (left) — edit/delete (bottom-right) */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {t.dueDate && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: overdue ? "#fff" : STYLES.slate, background: overdue ? STYLES.wax : STYLES.ink + "0d", padding: "2px 8px", borderRadius: 10 }}>
                          <CalendarDays size={11} /> {overdue ? "Overdue " : ""}{t.dueDate}
                        </span>
                      )}
                      {t.recurrence && t.recurrence !== "none" && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: STYLES.slate, background: STYLES.ink + "0d", padding: "2px 8px", borderRadius: 10 }}>
                          <Repeat size={11} /> {t.recurrence}
                        </span>
                      )}
                      {t.createdBy !== t.owner && <span style={{ fontSize: 11, color: STYLES.slate, background: STYLES.ink + "0d", padding: "2px 8px", borderRadius: 10 }}>added by {t.createdBy}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: "auto" }}>
                      <button onClick={() => startEdit(t)} aria-label="Edit task" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate, padding: 4 }}><Pencil size={15} /></button>
                      <button onClick={() => deleteTask(t.id)} aria-label="Delete task" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate, padding: 4 }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
