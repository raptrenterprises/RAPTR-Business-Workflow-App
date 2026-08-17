import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Save, X, CalendarDays, ClipboardList, MessageSquare, SlidersHorizontal, Repeat } from "lucide-react";
import {
  STYLES, uid, todayStr, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, toStr,
  importanceColor, urgencyColor, selectStyle, EVENT_CATEGORIES, EVENT_CATEGORY_COLOR, effectiveUrgency,
  eventCoversDay, EVENT_RECURRENCE_OPTIONS, TIME_ZONE, formatClockTime,
} from "../constants";
import { Badge, CenterMsg, ErrorBar } from "../components/Shared";
import { fetchEvents, insertEvent, updateEvent, deleteEventRow, subscribeEvents } from "../lib/eventsApi";
import { fetchTasks, subscribeTasks } from "../lib/tasksApi";
import { fetchThreads, subscribeThreads } from "../lib/threadsApi";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isOpen(item) {
  return item.kind === "task" ? !item.completed : item.status !== "complete";
}

// The date each item should surface on the calendar: an explicit due date
// always wins; otherwise items that are *currently* Immediate or High
// urgency (recomputed live via effectiveUrgency) surface on today's cell.
// Medium/Low/N/A items without a due date don't get a day-specific slot —
// see weekBucket/monthBucket below.
function triggerDateFor(item) {
  if (item.dueDate) return item.dueDate;
  const urg = effectiveUrgency(item);
  if (urg === "Immediate" || urg === "High") return todayStr();
  return null;
}

function eventLabel(e) {
  if (e.allDay || !e.time) return e.title;
  return `${formatClockTime(e.time)} ${e.title}`;
}

const emptyDraft = (date) => ({ title: "", description: "", category: "Other", date, endDate: date, time: "", allDay: true, recurrence: "none", recurrenceEnd: "" });

export default function CalendarSection({ currentUser, users }) {
  const [view, setView] = useState("week"); // "day" | "week" | "month"
  const [refDate, setRefDate] = useState(todayStr());
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft(todayStr()));
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [error, setError] = useState("");
  const [includeShared, setIncludeShared] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  const [showScopeMenu, setShowScopeMenu] = useState(false);

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

  // Default scope: your own tasks + threads currently waiting on you.
  // The filter icon can widen this to include shared tasks and/or everything.
  const openItems = useMemo(() => {
    const open = [...tasks, ...threads].filter(isOpen);
    if (includeAll) return open;
    return open.filter((it) => {
      if (it.kind === "task") {
        if (it.owner === currentUser) return true;
        if (includeShared && it.owner === "shared") return true;
        return false;
      }
      // thread: only ones currently waiting on you, by default
      return it.turn === currentUser;
    });
  }, [tasks, threads, currentUser, includeShared, includeAll]);

  const dayItemsFor = useCallback(
    (dateStr) => {
      const dayEvents = events.filter((e) => eventCoversDay(e, dateStr));
      const dayTasks = openItems.filter((it) => triggerDateFor(it) === dateStr);
      return { events: dayEvents, tasks: dayTasks };
    },
    [events, openItems]
  );

  // Medium/Low items with no due date don't get a specific day — they show
  // in a dedicated panel instead (only while viewing that granularity).
  // Due-date items with a computed Medium/Low urgency already appear on
  // their actual due date via dayItemsFor, so they're excluded here.
  const weekBucket = useMemo(() => openItems.filter((it) => !it.dueDate && effectiveUrgency(it) === "Medium"), [openItems]);
  const monthBucket = useMemo(() => openItems.filter((it) => !it.dueDate && effectiveUrgency(it) === "Low"), [openItems]);

  async function addEvent() {
    const title = draft.title.trim();
    if (!title) return;
    const ev = {
      id: uid(), title, description: draft.description.trim(), category: draft.category,
      date: draft.date, endDate: draft.endDate && draft.endDate >= draft.date ? draft.endDate : draft.date,
      time: draft.allDay ? null : draft.time || null, allDay: draft.allDay,
      recurrence: draft.recurrence || "none", recurrenceEnd: draft.recurrenceEnd || null,
      createdBy: currentUser, createdAt: new Date().toISOString(),
    };
    setDraft(emptyDraft(draft.date));
    setComposing(false);
    try { await insertEvent(ev); reloadEvents(); } catch (e) { setError("Couldn't add event: " + e.message); }
  }

  function startEditEvent(ev) {
    setEditingId(ev.id);
    setEditDraft({ title: ev.title, description: ev.description || "", category: ev.category || "Other", date: ev.date, endDate: ev.endDate || ev.date, time: ev.time || "", allDay: ev.allDay, recurrence: ev.recurrence || "none", recurrenceEnd: ev.recurrenceEnd || "" });
  }

  async function saveEditEvent(id) {
    const title = editDraft.title.trim();
    if (!title) return;
    try {
      await updateEvent(id, {
        title, description: editDraft.description.trim(), category: editDraft.category,
        date: editDraft.date, endDate: editDraft.endDate && editDraft.endDate >= editDraft.date ? editDraft.endDate : editDraft.date,
        time: editDraft.allDay ? null : editDraft.time || null, allDay: editDraft.allDay,
        recurrence: editDraft.recurrence || "none", recurrenceEnd: editDraft.recurrenceEnd || null,
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
    if (view === "day") return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: TIME_ZONE });
    if (view === "week") {
      const s = startOfWeek(refDate), e = endOfWeek(refDate);
      return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: TIME_ZONE })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: TIME_ZONE })}`;
    }
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: TIME_ZONE });
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
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowScopeMenu((s) => !s)} title="Filter what's shown" style={{ ...selectStyle(), cursor: "pointer", display: "flex", alignItems: "center", gap: 5, background: (includeShared || includeAll) ? STYLES.brass + "33" : "#fff" }}>
              <SlidersHorizontal size={13} /> Filter
            </button>
            {showScopeMenu && (
              <>
                <div onClick={() => setShowScopeMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 30, background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 12, width: 240, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", fontSize: 13 }}>
                  <div style={{ color: STYLES.slate, marginBottom: 8 }}>By default this shows only your tasks and threads waiting on you.</div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={includeShared} disabled={includeAll} onChange={(e) => setIncludeShared(e.target.checked)} /> Include shared tasks
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} /> Show everything (both people)
                  </label>
                </div>
              </>
            )}
          </div>
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
            onSelectEvent={setSelectedEvent}
          />
        )}
        {view === "week" && <WeekView refDate={refDate} dayItemsFor={dayItemsFor} weekBucket={weekBucket} onPick={setRefDate} setView={setView} onSelectEvent={setSelectedEvent} />}
        {view === "month" && <MonthView refDate={refDate} dayItemsFor={dayItemsFor} monthBucket={monthBucket} onPick={setRefDate} setView={setView} onSelectEvent={setSelectedEvent} />}
      </main>

      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onEdit={(ev) => { startEditEvent(ev); setView("day"); setRefDate(ev.date); }} />
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
        <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
          Repeats
          <select value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })} style={selectStyle()}>
            {EVENT_RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        {draft.recurrence !== "none" && (
          <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 5 }}>
            Repeat until <input type="date" value={draft.recurrenceEnd} min={draft.date} onChange={(e) => setDraft({ ...draft, recurrenceEnd: e.target.value })} style={selectStyle()} placeholder="Forever" />
          </label>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onSave} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}><Save size={13} /> {saveLabel}</button>
          <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}><X size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function ItemChip({ item }) {
  const urg = effectiveUrgency(item);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: `${urgencyColor(urg)}18`, border: `1px solid ${urgencyColor(urg)}55`, marginBottom: 3 }}>
      {item.kind === "task" ? <ClipboardList size={10} color={urgencyColor(urg)} /> : <MessageSquare size={10} color={urgencyColor(urg)} />}
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
              <Badge label={`U: ${effectiveUrgency(it)}`} color={urgencyColor(effectiveUrgency(it))} />
              <Badge label={`I: ${it.importance}`} color={importanceColor(it.importance)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part) || /^www\./.test(part)) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: STYLES.wax, wordBreak: "break-all" }}>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function EventDetailModal({ event, onClose, onEdit }) {
  if (!event) return null;
  const color = EVENT_CATEGORY_COLOR[event.category] || STYLES.brass;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>{event.category}</span>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "4px 0 0", color: STYLES.ink }}>{event.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0 }}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 13, color: STYLES.slate, marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <CalendarDays size={13} /> {event.date}{event.endDate && event.endDate !== event.date ? ` → ${event.endDate}` : ""}
          </span>
          {!event.allDay && event.time && <span>{event.time}</span>}
          {event.recurrence && event.recurrence !== "none" && (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Repeat size={13} /> {event.recurrence}{event.recurrenceEnd ? ` until ${event.recurrenceEnd}` : ""}</span>
          )}
        </div>

        {event.description ? (
          <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", color: STYLES.ink, userSelect: "text", marginBottom: 18 }}>
            {linkify(event.description)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: STYLES.slate, fontStyle: "italic", marginBottom: 18 }}>No description.</div>
        )}

        <button onClick={() => { onEdit(event); onClose(); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}55`, color: STYLES.slate, borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <Pencil size={12} /> Edit
        </button>
      </div>
    </div>
  );
}
function DayView({ date, dayItemsFor, editingId, editDraft, setEditDraft, onStartEdit, onSaveEdit, onCancelEdit, onRemoveEvent, onSelectEvent }) {
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
                <div onClick={() => onSelectEvent(e)} style={{ flex: 1, cursor: "pointer" }}>
                  <div>
                    {eventLabel(e)} {e.endDate && e.endDate !== e.date && <span style={{ fontSize: 11, color: STYLES.slate }}>({e.date} → {e.endDate})</span>}
                    {e.recurrence && e.recurrence !== "none" && <Repeat size={11} color={STYLES.slate} style={{ marginLeft: 6, verticalAlign: "middle" }} />}
                  </div>
                  {e.description && <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</div>}
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

function WeekView({ refDate, dayItemsFor, weekBucket, onPick, setView, onSelectEvent }) {
  const start = startOfWeek(refDate);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return toStr(d); });
  return (
    <>
      <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: 8, width: "max-content", minWidth: "100%" }}>
        {days.map((d) => {
          const { events, tasks } = dayItemsFor(d);
          const isToday = d === todayStr();
          return (
            <div key={d} onClick={() => { onPick(d); setView("day"); }} style={{ background: "#fff", border: `1px solid ${isToday ? STYLES.wax : STYLES.ink + "22"}`, borderRadius: 6, padding: 8, cursor: "pointer", minHeight: 120 }}>
              <div style={{ fontSize: 11, color: STYLES.slate }}>{WEEKDAYS[new Date(d + "T00:00:00").getDay()]}</div>
              <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? STYLES.wax : STYLES.ink, marginBottom: 4 }}>{Number(d.slice(8, 10))}</div>
              {events.map((e) => (
                <div key={e.id} onClick={(ev) => { ev.stopPropagation(); onSelectEvent(e); }} style={{ fontSize: 11, background: `${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}22`, borderLeft: `3px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}`, borderRadius: 3, padding: "2px 5px", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{eventLabel(e)}</div>
              ))}
              <TasksBox items={tasks} label="Tasks" />
            </div>
          );
        })}
        </div>
      </div>
      <BucketPanel title="This Week — Medium priority" items={weekBucket} />
    </>
  );
}

function MonthView({ refDate, dayItemsFor, monthBucket, onPick, setView, onSelectEvent }) {
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
          <div key={w} style={{ background: STYLES.brass + "33", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "6px 0", color: STYLES.ink }}>{w}</div>
        ))}
        {days.map((d) => {
          const { events, tasks } = dayItemsFor(d);
          const isToday = d === todayStr();
          const inMonth = thisMonth(d);
          return (
            <div key={d} onClick={() => { onPick(d); setView("day"); }} style={{ background: inMonth ? "#fff" : STYLES.gray, minHeight: 88, padding: 6, cursor: "pointer", opacity: inMonth ? 1 : 0.6 }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? STYLES.wax : STYLES.ink, marginBottom: 3 }}>{Number(d.slice(8, 10))}</div>
              {events.slice(0, 2).map((e) => (
                <div key={e.id} onClick={(ev) => { ev.stopPropagation(); onSelectEvent(e); }} style={{ fontSize: 10, background: `${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}22`, borderLeft: `2px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}`, borderRadius: 3, padding: "1px 4px", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{eventLabel(e)}</div>
              ))}
              {tasks.length > 0 && (
                <div style={{ fontSize: 10, color: urgencyColor(effectiveUrgency(tasks[0])), fontWeight: 700 }}>● {tasks.length} task{tasks.length > 1 ? "s" : ""}</div>
              )}
            </div>
          );
        })}
      </div>
      <BucketPanel title="This Month — Low priority" items={monthBucket} />
    </>
  );
}
