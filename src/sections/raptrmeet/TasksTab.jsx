import { useState, useMemo } from "react";
import { Plus, X, Trash2, Check, Link2, Unlink, ListChecks } from "lucide-react";
import { STYLES, uid, selectStyle, TASK_TAGS, TASK_TAG_COLOR } from "../../constants";
import { Badge } from "../../components/Shared";

const emptyDraft = () => ({ title: "", owner: "shared", tags: [], raptrmeetOnly: true });

// Hoisted to module scope so React keeps this component's identity across
// re-renders instead of remounting every row (see TasksSection.jsx for why
// that matters).
function TaskRow({ t, onToggle, onUnassign, onRemove }) {
  const style = { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 4, padding: "10px 12px", opacity: t.completed ? 0.55 : 1 };
  return (
    <li style={style}>
      <button onClick={() => onToggle(t)} aria-label="Toggle" style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${t.completed ? STYLES.brass : STYLES.slate}`, background: t.completed ? STYLES.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        {t.completed && <Check size={12} color="#fff" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, textDecoration: t.completed ? "line-through" : "none", overflowWrap: "anywhere" }}>{t.title}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: STYLES.slate, background: STYLES.ink + "0d", padding: "2px 7px", borderRadius: 10 }}>{t.owner === "shared" ? "Shared" : t.owner}</span>
          {t.raptrmeetOnly && <span style={{ fontSize: 10, color: STYLES.wax, background: STYLES.wax + "1a", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>In-person only</span>}
          {(t.tags || []).map((tag) => <Badge key={tag} label={tag} color={TASK_TAG_COLOR[tag] || STYLES.slate} />)}
        </div>
      </div>
      <button onClick={() => onUnassign(t)} title="Remove from this RAPTRMeet (stays on main Tasks list)" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0 }}><Unlink size={15} /></button>
      <button onClick={() => onRemove(t)} title="Delete task" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0 }}><Trash2 size={15} /></button>
    </li>
  );
}

export default function TasksTab({ meet, allTasks, currentUser, users, onInsertTask, onUpdateTask, onDeleteTask, setError }) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [assignQuery, setAssignQuery] = useState("");

  const meetTasks = useMemo(() => allTasks.filter((t) => t.raptrmeetId === meet.id), [allTasks, meet.id]);
  const open = meetTasks.filter((t) => !t.completed);
  const done = meetTasks.filter((t) => t.completed);

  const assignable = useMemo(() => {
    const q = assignQuery.trim().toLowerCase();
    return allTasks
      .filter((t) => !t.raptrmeetId && !t.completed)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allTasks, assignQuery]);

  function toggleDraftTag(tag) {
    setDraft((d) => ({ ...d, tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag] }));
  }

  async function addTask() {
    const title = draft.title.trim();
    if (!title) return;
    const task = {
      id: uid(), title, owner: draft.owner, completed: false, createdBy: currentUser, createdAt: new Date().toISOString(),
      importance: "Medium", urgency: "Medium", dueDate: null, recurrence: "none", attachments: [],
      tags: draft.tags, raptrmeetId: meet.id, raptrmeetOnly: draft.raptrmeetOnly, raptrmeetDay: null, raptrmeetTimeblock: null,
    };
    setComposing(false);
    setDraft(emptyDraft());
    try { await onInsertTask(task); } catch (e) { setError("Couldn't add task: " + e.message); }
  }

  async function toggle(t) { try { await onUpdateTask(t.id, { completed: !t.completed }); } catch (e) { setError("Couldn't update task: " + e.message); } }
  async function unassign(t) { try { await onUpdateTask(t.id, { raptrmeetId: null, raptrmeetDay: null, raptrmeetTimeblock: null }); } catch (e) { setError("Couldn't unassign task: " + e.message); } }
  async function assign(t) { try { await onUpdateTask(t.id, { raptrmeetId: meet.id }); setAssignPickerOpen(false); setAssignQuery(""); } catch (e) { setError("Couldn't assign task: " + e.message); } }
  async function remove(t) { try { await onDeleteTask(t.id); } catch (e) { setError("Couldn't delete task: " + e.message); } }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, display: "flex", alignItems: "center", gap: 6 }}><ListChecks size={14} /> Tasks for this RAPTRMeet</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setAssignPickerOpen((o) => !o); setComposing(false); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
            <Link2 size={14} /> Assign existing
          </button>
          <button onClick={() => { setComposing((c) => !c); setAssignPickerOpen(false); }} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
            <Plus size={14} /> New task
          </button>
        </div>
      </div>

      {assignPickerOpen && (
        <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 12 }}>
          <input autoFocus value={assignQuery} onChange={(e) => setAssignQuery(e.target.value)} placeholder="Search unassigned tasks…" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13, marginBottom: 8 }} />
          {assignable.length === 0 ? (
            <div style={{ fontSize: 13, color: STYLES.slate }}>No unassigned tasks match.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {assignable.map((t) => (
                <li key={t.id}>
                  <button onClick={() => assign(t)} style={{ width: "100%", textAlign: "left", background: STYLES.ink + "06", border: "none", borderRadius: 4, padding: "7px 9px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{t.title}</span>
                    <span style={{ color: STYLES.slate }}>{t.owner === "shared" ? "Shared" : t.owner}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {composing && (
        <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14 }}>
          <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Task title…" style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14, marginBottom: 10 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
              For
              <select value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} style={selectStyle()}>
                <option value="shared">Shared</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
              <input type="checkbox" checked={draft.raptrmeetOnly} onChange={(e) => setDraft({ ...draft, raptrmeetOnly: e.target.checked })} /> Must be done in person at a RAPTRMeet
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {TASK_TAGS.map((tag) => (
              <button key={tag} onClick={() => toggleDraftTag(tag)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 12, border: `1px solid ${TASK_TAG_COLOR[tag]}`, background: draft.tags.includes(tag) ? TASK_TAG_COLOR[tag] : "#fff", color: draft.tags.includes(tag) ? "#fff" : TASK_TAG_COLOR[tag], cursor: "pointer", fontWeight: 600 }}>{tag}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={addTask} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Add</button>
            <button onClick={() => setComposing(false)} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}><X size={14} /></button>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: STYLES.slate, marginBottom: 6 }}>Open ({open.length})</div>
        {open.length === 0 ? (
          <div style={{ fontSize: 13, color: STYLES.slate, padding: "8px 0" }}>Nothing yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {open.map((t) => <TaskRow key={t.id} t={t} onToggle={toggle} onUnassign={unassign} onRemove={remove} />)}
          </ul>
        )}
      </div>
      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: STYLES.slate, marginBottom: 6 }}>Completed ({done.length})</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {done.map((t) => <TaskRow key={t.id} t={t} onToggle={toggle} onUnassign={unassign} onRemove={remove} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
