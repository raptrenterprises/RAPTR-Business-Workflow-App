import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Save, X, CalendarDays, ClipboardList, MessageSquare } from "lucide-react";
import {
  STYLES, uid, todayStr, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, toStr,
  importanceColor, urgencyColor, selectStyle, EVENT_CATEGORIES, EVENT_CATEGORY_COLOR,
} from "../constants";
import { Badge, CenterMsg, ErrorBar } from "../components/Shared";
import { fetchEvents, insertEvent, updateEvent, deleteEventRow, subscribeEvents } from "../lib/eventsApi";
import { fetchTasks, subscribeTasks } from "../lib/tasksApi";
import { fetchThreads, subscribeThreads } from "../lib/threadsApi";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isOpen(item) {
  return item.kind === "task" ? !item.completed : item.status !== "complete";
}

// The date each item should surface on the calendar per urgency rule,
// or null if it doesn't get a day-specific slot (Medium/Low/N/A are handled separately).
function triggerDateFor(item) {
  if (item.dueDate) return item.dueDate; // an explicit due date always wins
  if (item.urgency === "Critical") return todayStr();
  if (item.urgency === "High") return addDays(item.createdAt, 2);
  return null;
}

function eventCoversDay(ev, dateStr) {
  return dateStr >= ev.date && dateStr <= (ev.endDate || ev.date);
}

const emptyDraft = (date) => ({ title: "", description: "", category: "Other", date, endDate: date, time: "", allDay: true });

export default function CalendarSection({ currentUser, users }) {
  const [view, setView] = useState("month"); // "day" | "week" | "month"
  const [refDate, setRefDate] = useState(todayStr());
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft(todayStr()));
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [error, setError] = useState("");

  const reloadEvents = useCallback(async () => {
    try { setEvents(await fetchEvents()); } catch (e) { setError("Couldn't load events: " + e.message); }
  }, []);
  const reloadTasks = useCallback(async () => {
    try { setTasks((await fetchTasks()).map((t) => ({ ...t, kind: "task" }))); } catch (e) { setError("Couldn't load tasks: " + e.message); }
  }, []);
  const reloadThreads = useCallback(async () => {
    try { setThreads((await fetchThreads()).map((t) => ({ ...t, kind: "thread" }))); } catch (e) { setError("Couldn't load threads: " + e.message); }
  }, []);

  useEffect(() => {
    Promise.all([reloadEvents(), reloadTasks(), reloadThreads()]).finally(() => setLoading(false));
    const u1 = subscribeEvents(reloadEvents);
    const u2 = subscribeTasks(reloadTasks);
    const u3 = subscribeThreads(reloadThreads);
    return () => { u1(); u2(); u3(); };
  }, [reloadEvents, reloadTasks, reloadThreads]);

  const openItems = useMemo(() => [...tasks, ...threads].filter(isOpen), [tasks, threads]);

  const dayItemsFor = useCallback(
    (dateStr) => {
      const dayEvents = events.filter((e) => eventCoversDay(e, dateStr));
      const dayTasks = openItems.filter((it) => it.urgency !== "N/A" && it.urgency !== "Medium" && it.urgency !== "Low" && triggerDateFor(it) === dateStr);
      return { events: dayEvents, tasks: dayTasks };
    },
    [events, openItems]
  );

  const weekBucket = useMemo(() => openItems.filter((it) => it.urgency === "Medium"), [openItems]);
  const monthBucket = useMemo(() => openItems.filter((it) => it.urgency === "Low"), [openItems]);

  async function addEvent() {
    const title = draft.title.trim();
    if (!title) return;
    const ev = {
      id: uid(), title, description: draft.description.trim(), category: draft.category,
      date: draft.date, endDate: draft.endDate && draft.endDate >= draft.date ? draft.endDate : draft.date,
      time: draft.allDay ? null : draft.time || null, allDay: draft.allDay,
      createdBy: currentUser, createdAt: new Date().toISOString(),
    };
    setDraft(emptyDraft(draft.date));
    setComposing(false);
    try { await insertEvent(ev); reloadEvents(); } catch (e) { setError("Couldn't add event: " + e.message); }
  }

  function startEditEvent(ev) {
    setEditingId(ev.id);
    setEditDraft({ title: ev.title, description: ev.description || "", category: ev.category || "Other", date: ev.date, endDate: ev.endDate || ev.date, time: ev.time || "", allDay: ev.allDay });
  }

  async function saveEditEvent(id) {
    const title = editDraft.title.trim();
    if (!title) return;
    try {
      await updateEvent(id, {
        title, description: editDraft.description.trim(), category: editDraft.category,
        date: editDraft.date, endDate: editDraft.endDate && editDraft.endDate >= editDraft.date ? editDraft.endDate : editDraft.date,
        time: editDraft.allDay ? null : editDraft.time || null, allDay: editDraft.allDay,
      });
      setEditingId(null); setEditDraft(null); reloadEvents();
    } catch (e) { setError("Couldn't save event: " + e.message); }
  }

  async function removeEvent(id) {
    try { await deleteEventRow(id); if (editingId === id) setEditingId(null); reloadEvents(); } catch (e) { setError("Couldn't delete event: " + e.message); }
  }

  function goToday() { setRefDate(todayStr()); }
  function step(delta) {
    if (view === "day") setRefDate(addDays(refDate, delta));
    else if (view === "week") setRefDate(addDays(refDate, delta * 7));
    else {
      const d = new Date(refDate + "T00:00:00");
      d.setMonth(d.getMonth() + delta);
      setRefDate(toStr(d));
    }
  }

  if (loading) return <CenterMsg>Loading the calendar…</CenterMsg>;

  const headerLabel = () => {
    const d = new Date(refDate + "T00:00:00");
    if (view === "day") return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(refDate), e = endOfWeek(refDate);
      return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn onClick={() => step(-1)}><ChevronLeft size={16} /></IconBtn>
            <button onClick={goToday} style={{ ...selectStyle(), cursor: "pointer" }}>Today</button>
            <IconBtn onClick={() => step(1)}><ChevronRight size={16} /></IconBtn>
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, flex: 1, minWidth: 160 }}>{headerLabel()}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["day", "week", "month"].map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ textTransform: "capitalize", padding: "6px 12px", borderRadius: 4, border: `1px solid ${STYLES.brass}`, background: view === v ? STYLES.brass : "transparent", color: view === v ? STYLES.ink : STYLES.slate, cursor: "pointer", fontSize: 13, fontWeight: view === v ? 700 : 400 }}>{v}</button>
            ))}
          </div>
          <button onClick={() => { setComposing((c) => !c); setDraft(emptyDraft(refDate)); }} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Plus size={14} /> Event
          </button>
        </div>

        {composing && <EventForm draft={draft} setDraft={setDraft} onSave={addEvent} onCancel={() => setComposing(false)} saveLabel="Add" />}

        {/* Category legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, fontSize: 11 }}>
          {EVENT_CATEGORIES.map((cat) => (
            <span key={cat} style={{ display: "flex", alignItems: "center", gap: 4, color: STYLES.slate }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: EVENT_CATEGORY_COLOR[cat] }} /> {cat}
            </span>
          ))}
        </div>

        {view === "day" && (
          <DayView
            date={refDate}
            dayItemsFor={dayItemsFor}
            editingId={editingId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onStartEdit={startEditEvent}
            onSaveEdit={saveEditEvent}
            onCancelEdit={() => { setEditingId(null); setEditDraft(null); }}
            onRemoveEvent={removeEvent}
          />
        )}
        {view === "week" && <WeekView refDate={refDate} dayItemsFor={dayItemsFor} weekBucket={weekBucket} onPick={setRefDate} setView={setView} />}
        {view === "month" && <MonthView refDate={refDate} dayItemsFor={dayItemsFor} monthBucket={monthBucket} onPick={setRefDate} setView={setView} />}
      </main>
    </>
  );
}

function IconBtn({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "#fff", border: `1px solid ${STYLES.ink}33`, borderRadius: 4, padding: 6, cursor: "pointer", display: "flex" }}>{children}</button>;
}

function EventForm({ draft, setDraft, onSave, onCancel, saveLabel }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14, marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Event title…" style={{ padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14 }} />
      <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)…" rows={2} style={{ padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
          Category
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ ...selectStyle(), color: EVENT_CATEGORY_COLOR[draft.category], fontWeight: 600 }}>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
          Starts <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value, endDate: draft.endDate < e.target.value ? e.target.value : draft.endDate })} style={selectStyle()} />
        </label>
        <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
          Ends <input type="date" value={draft.endDate} min={draft.date} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} style={selectStyle()} />
        </label>
        <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
          <input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} /> All day
        </label>
        {!draft.allDay && <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={selectStyle()} />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onSave} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}><Save size={13} /> {saveLabel}</button>
          <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}><X size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function ItemChip({ item }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: `${urgencyColor(item.urgency)}18`, border: `1px solid ${urgencyColor(item.urgency)}55`, marginBottom: 3 }}>
      {item.kind === "task" ? <ClipboardList size={10} color={urgencyColor(item.urgency)} /> : <MessageSquare size={10} color={urgencyColor(item.urgency)} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
    </div>
  );
}

function TasksBox({ items, label = "Tasks & Threads" }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 6, background: STYLES.ink + "08", border: `1px dashed ${STYLES.ink}22`, borderRadius: 4, padding: 6 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: STYLES.slate, marginBottom: 4 }}>{label}</div>
      {items.map((it) => <ItemChip key={it.id} item={it} />)}
    </div>
  );
}

function BucketPanel({ title, items }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 14, marginTop: 18 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: STYLES.slate }}>Nothing here right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              {it.kind === "task" ? <ClipboardList size={13} color={STYLES.slate} /> : <MessageSquare size={13} color={STYLES.slate} />}
              <span style={{ flex: 1 }}>{it.title}</span>
              <Badge label={`I: ${it.importance}`} color={importanceColor(it.importance)} />
              <Badge label={`U: ${it.urgency}`} color={urgencyColor(it.urgency)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayView({ date, dayItemsFor, editingId, editDraft, setEditDraft, onStartEdit, onSaveEdit, onCancelEdit, onRemoveEvent }) {
  const { events, tasks } = dayItemsFor(date);
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 18 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: STYLES.slate, marginBottom: 8 }}>Events</div>
      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: STYLES.slate, marginBottom: 16 }}>No events today.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {events.map((e) =>
            editingId === e.id ? (
              <EventForm key={e.id} draft={editDraft} setDraft={setEditDraft} onSave={() => onSaveEdit(e.id)} onCancel={onCancelEdit} saveLabel="Save" />
            ) : (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, background: `${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}14`, borderLeft: `4px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}`, border: `1px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}55`, borderLeftWidth: 4, borderRadius: 4, padding: "8px 10px" }}>
                <CalendarDays size={14} color={EVENT_CATEGORY_COLOR[e.category] || STYLES.brass} />
                <div style={{ flex: 1 }}>
                  <div>{e.title} {e.endDate && e.endDate !== e.date && <span style={{ fontSize: 11, color: STYLES.slate }}>({e.date} → {e.endDate})</span>}</div>
                  {e.description && <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 2 }}>{e.description}</div>}
                </div>
                {!e.allDay && e.time && <span style={{ fontSize: 12, color: STYLES.slate }}>{e.time}</span>}
                <span style={{ fontSize: 10, color: EVENT_CATEGORY_COLOR[e.category] || STYLES.slate, fontWeight: 700 }}>{e.category}</span>
                <button onClick={() => onStartEdit(e)} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate }}><Pencil size={13} /></button>
                <button onClick={() => onRemoveEvent(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate }}><Trash2 size={13} /></button>
              </div>
            )
          )}
        </div>
      )}
      <TasksBox items={tasks} />
    </div>
  );
}

function WeekView({ refDate, dayItemsFor, weekBucket, onPick, setView }) {
  const start = startOfWeek(refDate);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return toStr(d); });
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: 8, overflowX: "auto" }}>
        {days.map((d) => {
          const { events, tasks } = dayItemsFor(d);
          const isToday = d === todayStr();
          return (
            <div key={d} onClick={() => { onPick(d); setView("day"); }} style={{ background: "#fff", border: `1px solid ${isToday ? STYLES.wax : STYLES.ink + "22"}`, borderRadius: 6, padding: 8, cursor: "pointer", minHeight: 120 }}>
              <div style={{ fontSize: 11, color: STYLES.slate }}>{WEEKDAYS[new Date(d + "T00:00:00").getDay()]}</div>
              <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? STYLES.wax : STYLES.ink, marginBottom: 4 }}>{Number(d.slice(8, 10))}</div>
              {events.map((e) => (
                <div key={e.id} style={{ fontSize: 11, background: `${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}22`, borderLeft: `3px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}`, borderRadius: 3, padding: "2px 5px", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
              ))}
              <TasksBox items={tasks} label="Tasks" />
            </div>
          );
        })}
      </div>
      <BucketPanel title="This Week — Medium priority" items={weekBucket} />
    </>
  );
}

function MonthView({ refDate, dayItemsFor, monthBucket, onPick, setView }) {
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  const gridStart = startOfWeek(toStr(monthStart));
  const gridEnd = endOfWeek(toStr(monthEnd));
  const days = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) { days.push(toStr(cursor)); cursor.setDate(cursor.getDate() + 1); }
  const thisMonth = (d) => new Date(d + "T00:00:00").getMonth() === monthStart.getMonth();

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: STYLES.ink + "22", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, overflow: "hidden" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ background: "#EAE3D1", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "6px 0", color: STYLES.slate }}>{w}</div>
        ))}
        {days.map((d) => {
          const { events, tasks } = dayItemsFor(d);
          const isToday = d === todayStr();
          const inMonth = thisMonth(d);
          return (
            <div key={d} onClick={() => { onPick(d); setView("day"); }} style={{ background: inMonth ? "#fff" : "#F7F3E9", minHeight: 88, padding: 6, cursor: "pointer", opacity: inMonth ? 1 : 0.5 }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? STYLES.wax : STYLES.ink, marginBottom: 3 }}>{Number(d.slice(8, 10))}</div>
              {events.slice(0, 2).map((e) => (
                <div key={e.id} style={{ fontSize: 10, background: `${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}22`, borderLeft: `2px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}`, borderRadius: 3, padding: "1px 4px", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
              ))}
              {tasks.length > 0 && (
                <div style={{ fontSize: 10, color: urgencyColor(tasks[0].urgency), fontWeight: 700 }}>● {tasks.length} task{tasks.length > 1 ? "s" : ""}</div>
              )}
            </div>
          );
        })}
      </div>
      <BucketPanel title="This Month — Low priority" items={monthBucket} />
    </>
  );
}
