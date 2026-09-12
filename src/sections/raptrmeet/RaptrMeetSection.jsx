import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, MapPin, UtensilsCrossed, CalendarCheck, ListChecks, Clock, ChevronDown, CheckCircle2, Archive } from "lucide-react";
import { STYLES, uid, todayStr, selectStyle } from "../../constants";
import { TabButton, CenterMsg, ErrorBar } from "../../components/Shared";
import { fetchRaptrMeets, insertRaptrMeet, updateRaptrMeet, subscribeRaptrMeets } from "../../lib/raptrmeetsApi";
import { fetchTasks, insertTask, updateTask, deleteTaskRow, subscribeTasks } from "../../lib/tasksApi";
import { fetchEvents, insertEvent, updateEvent, deleteEventRow, subscribeEvents } from "../../lib/eventsApi";
import { completeRaptrMeet } from "../../lib/raptrmeetLogic";
import DatesTab from "./DatesTab";
import MealsTab from "./MealsTab";
import ActivitiesTab from "./ActivitiesTab";
import TasksTab from "./TasksTab";
import TimelineTab from "./TimelineTab";

const SUBTABS = [
  { key: "dates", label: "Dates & Travel", icon: <MapPin size={14} /> },
  { key: "meals", label: "Food & Grocery", icon: <UtensilsCrossed size={14} /> },
  { key: "activities", label: "Activities", icon: <CalendarCheck size={14} /> },
  { key: "tasks", label: "Tasks", icon: <ListChecks size={14} /> },
  { key: "timeline", label: "Daily Plan", icon: <Clock size={14} /> },
];

const emptyMeetDraft = () => ({ id: uid(), title: "", startDate: "", endDate: "" });

export default function RaptrMeetSection({ currentUser, users }) {
  const [meets, setMeets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [subtab, setSubtab] = useState("dates");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyMeetDraft());
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [meetPickerOpen, setMeetPickerOpen] = useState(false);

  const reloadMeets = useCallback(async () => {
    try { setMeets(await fetchRaptrMeets()); } catch (e) { setError("Couldn't load RAPTRMeets: " + e.message); }
  }, []);
  const reloadTasks = useCallback(async () => {
    try { setTasks(await fetchTasks()); } catch (e) { setError("Couldn't load tasks: " + e.message); }
  }, []);
  const reloadEvents = useCallback(async () => {
    try { setEvents(await fetchEvents()); } catch (e) { setError("Couldn't load events: " + e.message); }
  }, []);

  useEffect(() => {
    Promise.all([reloadMeets(), reloadTasks(), reloadEvents()]).finally(() => setLoading(false));
    const u1 = subscribeRaptrMeets(reloadMeets);
    const u2 = subscribeTasks(reloadTasks);
    const u3 = subscribeEvents(reloadEvents);
    return () => { u1(); u2(); u3(); };
  }, [reloadMeets, reloadTasks, reloadEvents]);

  // Default to the soonest upcoming meet; once meets load, pick one if nothing's selected yet.
  useEffect(() => {
    if (selectedId || meets.length === 0) return;
    const upcoming = meets.filter((m) => m.status !== "completed").sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    setSelectedId((upcoming[0] || meets[meets.length - 1]).id);
  }, [meets, selectedId]);

  const selectedMeet = useMemo(() => meets.find((m) => m.id === selectedId) || null, [meets, selectedId]);
  const visibleMeets = useMemo(() => {
    const sorted = meets.slice().sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    return showPast ? sorted : sorted.filter((m) => m.status !== "completed");
  }, [meets, showPast]);

  async function addMeet() {
    const title = draft.title.trim();
    if (!title || !draft.startDate || !draft.endDate) return;
    const rm = {
      id: draft.id, title, startDate: draft.startDate, endDate: draft.endDate >= draft.startDate ? draft.endDate : draft.startDate,
      location: "", address: "", status: "upcoming", travel: {}, meals: [], groceryItems: [], notes: "", attachments: [],
      createdBy: currentUser, createdAt: new Date().toISOString(),
    };
    setComposing(false);
    setDraft(emptyMeetDraft());
    try { await insertRaptrMeet(rm); await reloadMeets(); setSelectedId(rm.id); } catch (e) { setError("Couldn't create RAPTRMeet: " + e.message); }
  }

  async function handleComplete(meet) {
    if (!window.confirm(`Mark "${meet.title}" as completed? Unfinished RAPTRMeet-only tasks will roll to the next RAPTRMeet; other unfinished tasks will stay on the main Tasks list.`)) return;
    try {
      const { movedCount, clearedCount, next } = await completeRaptrMeet(meet, meets, tasks, { updateTask, updateRaptrMeet });
      await Promise.all([reloadMeets(), reloadTasks()]);
      const bits = [];
      if (movedCount) bits.push(`${movedCount} task${movedCount === 1 ? "" : "s"} rolled to ${next ? `"${next.title}"` : "no RAPTRMeet yet (assign later)"}`);
      if (clearedCount) bits.push(`${clearedCount} task${clearedCount === 1 ? "" : "s"} returned to the main Tasks list`);
      if (bits.length) window.alert(bits.join(". ") + ".");
    } catch (e) { setError("Couldn't complete RAPTRMeet: " + e.message); }
  }

  if (loading) return <CenterMsg>Loading RAPTRMeet…</CenterMsg>;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>

      <div style={{ background: STYLES.brass, borderBottom: `1px solid ${STYLES.ink}22`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <button onClick={() => setMeetPickerOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#fff", border: `1px solid ${STYLES.ink}33`, borderRadius: 4, padding: "8px 10px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedMeet ? selectedMeet.title : "No RAPTRMeets yet"}
                {selectedMeet && <span style={{ fontWeight: 400, color: STYLES.slate, marginLeft: 8, fontSize: 12 }}>{selectedMeet.startDate} → {selectedMeet.endDate}{selectedMeet.status === "completed" ? " · Completed" : ""}</span>}
              </span>
              <ChevronDown size={16} />
            </button>
            {meetPickerOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "#fff", border: `1px solid ${STYLES.ink}33`, borderRadius: 4, marginTop: 4, boxShadow: "0 6px 18px rgba(0,0,0,0.15)", maxHeight: 320, overflowY: "auto" }}>
                {visibleMeets.map((m) => (
                  <button key={m.id} onClick={() => { setSelectedId(m.id); setMeetPickerOpen(false); }} style={{ width: "100%", textAlign: "left", background: m.id === selectedId ? STYLES.brass + "33" : "transparent", border: "none", borderBottom: `1px solid ${STYLES.ink}11`, padding: "9px 12px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{m.title}</span>
                    <span style={{ color: STYLES.slate }}>{m.startDate}{m.status === "completed" ? " · done" : ""}</span>
                  </button>
                ))}
                {visibleMeets.length === 0 && <div style={{ padding: 12, fontSize: 13, color: STYLES.slate }}>None yet.</div>}
                <button onClick={() => setShowPast((s) => !s)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 12px", cursor: "pointer", fontSize: 12, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
                  <Archive size={12} /> {showPast ? "Hide" : "Show"} completed RAPTRMeets
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { setComposing(true); setMeetPickerOpen(false); }} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexShrink: 0 }}>
            <Plus size={15} /> New
          </button>
          {selectedMeet && selectedMeet.status !== "completed" && (
            <button onClick={() => handleComplete(selectedMeet)} title="Mark this RAPTRMeet completed" style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexShrink: 0 }}>
              <CheckCircle2 size={15} /> Mark completed
            </button>
          )}
        </div>
      </div>

      {composing && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 16px 0" }}>
          <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14 }}>
            <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="RAPTRMeet name (e.g. Fall 2026 RAPTRMeet)" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 15, marginBottom: 10 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                Start <input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value, endDate: draft.endDate && draft.endDate >= e.target.value ? draft.endDate : e.target.value })} style={selectStyle()} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                End <input type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} style={selectStyle()} />
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={addMeet} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", cursor: "pointer", fontSize: 14 }}>Create</button>
                <button onClick={() => { setComposing(false); setDraft(emptyMeetDraft()); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "9px 12px", cursor: "pointer" }}><X size={15} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedMeet ? (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
          <CenterMsg>Create your first RAPTRMeet to start planning.</CenterMsg>
        </main>
      ) : (
        <>
          <div style={{ display: "flex", borderBottom: `1px solid ${STYLES.ink}22`, background: "#fff", overflowX: "auto" }}>
            {SUBTABS.map((t) => <TabButton key={t.key} active={subtab === t.key} onClick={() => setSubtab(t.key)} icon={t.icon} label={t.label} />)}
          </div>
          <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
            {subtab === "dates" && (
              <DatesTab meet={selectedMeet} users={users} currentUser={currentUser} onUpdate={(patch) => updateRaptrMeet(selectedMeet.id, patch)} setError={setError} />
            )}
            {subtab === "meals" && (
              <MealsTab meet={selectedMeet} currentUser={currentUser} users={users} onUpdate={(patch) => updateRaptrMeet(selectedMeet.id, patch)} setError={setError} />
            )}
            {subtab === "activities" && (
              <ActivitiesTab
                meet={selectedMeet} events={events} currentUser={currentUser}
                onInsertEvent={async (ev) => { await insertEvent(ev); reloadEvents(); }}
                onUpdateEvent={async (id, patch) => { await updateEvent(id, patch); reloadEvents(); }}
                onDeleteEvent={async (id) => { await deleteEventRow(id); reloadEvents(); }}
                setError={setError}
              />
            )}
            {subtab === "tasks" && (
              <TasksTab
                meet={selectedMeet} allTasks={tasks} currentUser={currentUser} users={users}
                onInsertTask={async (t) => { await insertTask(t); reloadTasks(); }}
                onUpdateTask={async (id, patch) => { await updateTask(id, patch); reloadTasks(); }}
                onDeleteTask={async (id) => { await deleteTaskRow(id); reloadTasks(); }}
                setError={setError}
              />
            )}
            {subtab === "timeline" && (
              <TimelineTab
                meet={selectedMeet} tasks={tasks} events={events} currentUser={currentUser}
                onUpdateTask={async (id, patch) => { await updateTask(id, patch); reloadTasks(); }}
                onUpdateMeet={(patch) => updateRaptrMeet(selectedMeet.id, patch)}
                setError={setError}
              />
            )}
          </main>
        </>
      )}
    </>
  );
}
