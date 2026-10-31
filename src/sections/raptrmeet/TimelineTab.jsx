import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Check, Sunrise, Sun, Moon, UtensilsCrossed, CalendarClock, X, Pencil, GripVertical, List, CalendarDays } from "lucide-react";
import { STYLES, todayStr, dateRange, eventCoversDay, formatET, formatClockTime, TIMEBLOCKS } from "../../constants";

const BLOCK_ICON = { morning: <Sunrise size={14} />, afternoon: <Sun size={14} />, evening: <Moon size={14} /> };
const MEAL_AFTER_BLOCK = { morning: "Breakfast", afternoon: "Lunch", evening: "Dinner" };

function timeBlockOfEvent(e) {
  if (e.allDay || !e.time) return null; // shown separately as "all day"
  const [h] = e.time.split(":").map(Number);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// Two-column "pick a box" scheduler: day options on the left, time-of-day
// options on the right. Hoisted to module scope so it keeps its identity
// (and open/close state doesn't remount every parent re-render).
function DayTimeblockPicker({ days, initialDay, initialBlock, onPick, onCancel, onClear }) {
  const [day, setDay] = useState(initialDay || null);
  const [block, setBlock] = useState(initialBlock || null);
  const pill = (active) => ({
    textAlign: "left", padding: "7px 10px", borderRadius: 4, border: `1px solid ${active ? STYLES.wax : STYLES.ink + "22"}`,
    background: active ? STYLES.wax : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 700 : 400,
    cursor: "pointer", fontSize: 12.5,
  });
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 10, marginTop: 6 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, color: STYLES.slate, fontWeight: 700, marginBottom: 2 }}>Day</div>
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)} style={pill(day === d)}>{formatET(d + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, color: STYLES.slate, fontWeight: 700, marginBottom: 2 }}>Time of day</div>
          {TIMEBLOCKS.map((b) => (
            <button key={b.value} onClick={() => setBlock(b.value)} style={pill(block === b.value)}>{b.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 10 }}>
        {onClear && <button onClick={onClear} style={{ marginRight: "auto", background: "transparent", border: "none", color: STYLES.wax, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Unschedule</button>}
        <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "6px 10px", cursor: "pointer" }}><X size={13} /></button>
        <button disabled={!day || !block} onClick={() => onPick(day, block)} style={{ background: day && block ? STYLES.wax : STYLES.slate, opacity: day && block ? 1 : 0.5, color: "#fff", border: "none", borderRadius: 4, padding: "6px 14px", cursor: day && block ? "pointer" : "default", fontSize: 12.5, fontWeight: 600 }}>{initialDay ? "Save" : "Set"}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop. HTML5 drag events don't fire on touch screens (the app is
// used as a phone PWA), so this uses pointer events: grab a task's handle,
// move, and release over a cell. Drop targets are plain elements carrying
// data-drop-day / data-drop-block (or data-drop-unscheduled).
// ---------------------------------------------------------------------------
function dropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el && el.closest ? el.closest("[data-drop-day],[data-drop-unscheduled]") : null;
  if (!cell) return null;
  if (cell.hasAttribute("data-drop-unscheduled")) return { unscheduled: true };
  return { day: cell.getAttribute("data-drop-day"), block: cell.getAttribute("data-drop-block") };
}

function TaskChip({ t, onToggle, onEdit, onGripDown, dragging, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 4, padding: "4px 4px", opacity: dragging ? 0.35 : t.completed ? 0.6 : 1 }}>
      <span onPointerDown={(e) => onGripDown(e, t)} title="Drag to move" style={{ touchAction: "none", cursor: "grab", display: "flex", alignItems: "center", color: STYLES.slate, padding: "4px 2px", flexShrink: 0 }}>
        <GripVertical size={14} />
      </span>
      {!compact && (
        <button onClick={() => onToggle(t)} aria-label="Toggle" style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${t.completed ? STYLES.brass : STYLES.slate}`, background: t.completed ? STYLES.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
          {t.completed && <Check size={10} color="#fff" />}
        </button>
      )}
      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", textDecoration: t.completed ? "line-through" : "none" }}>{t.title}</span>
      <button onClick={() => onEdit(t)} title="Edit schedule" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, padding: 2, display: "flex", flexShrink: 0 }}><Pencil size={12} /></button>
    </div>
  );
}

function CalendarView({ days, meetTasks, unscheduled, events, onMove, onToggle, onEdit }) {
  const [drag, setDrag] = useState(null); // { task, x, y, target }
  const scrollRef = useRef(null);
  const dragRef = useRef(null);
  const startRef = useRef(null);

  const finish = useCallback((commit) => {
    const d = dragRef.current;
    dragRef.current = null; startRef.current = null;
    setDrag(null);
    if (commit && d && d.target) onMove(d.task, d.target);
  }, [onMove]);

  useEffect(() => {
    function move(e) {
      const st = startRef.current;
      if (!st) return;
      if (!dragRef.current) {
        if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
        dragRef.current = { task: st.task, x: e.clientX, y: e.clientY, target: null };
      }
      e.preventDefault();
      const target = dropTargetAt(e.clientX, e.clientY);
      dragRef.current = { ...dragRef.current, x: e.clientX, y: e.clientY, target };
      setDrag(dragRef.current);
      // Auto-scroll the grid sideways when dragging near its edges.
      const sc = scrollRef.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (e.clientX > r.right - 36) sc.scrollLeft += 14;
        else if (e.clientX < r.left + 36) sc.scrollLeft -= 14;
      }
    }
    function up() { if (startRef.current) finish(!!dragRef.current); }
    function cancel() { if (startRef.current) finish(false); }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [finish]);

  function onGripDown(e, task) {
    if (e.button !== undefined && e.button !== 0) return;
    startRef.current = { task, x: e.clientX, y: e.clientY };
  }

  const draggingId = drag ? drag.task.id : null;
  const isHover = (day, block) => drag && drag.target && drag.target.day === day && drag.target.block === block;
  const hoverUnsched = drag && drag.target && drag.target.unscheduled;
  const COL = 150;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div data-drop-unscheduled="1" style={{ background: hoverUnsched ? STYLES.brass + "33" : "#fff", border: `1px dashed ${hoverUnsched ? STYLES.wax : STYLES.brass}`, borderRadius: 6, padding: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: STYLES.ink, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Unscheduled ({unscheduled.length}) — drag onto a day, or drop a task here to unschedule it</div>
        {unscheduled.length === 0 ? (
          <div style={{ fontSize: 12, color: STYLES.slate }}>Everything is scheduled.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
            {unscheduled.map((t) => <TaskChip key={t.id} t={t} compact onToggle={onToggle} onEdit={onEdit} onGripDown={onGripDown} dragging={draggingId === t.id} />)}
          </div>
        )}
      </div>

      <div ref={scrollRef} style={{ overflowX: "auto", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: `64px repeat(${days.length}, minmax(${COL}px, 1fr))`, minWidth: 64 + days.length * COL }}>
          <div style={{ background: STYLES.brass + "22", borderBottom: `1px solid ${STYLES.ink}1a`, position: "sticky", left: 0, zIndex: 2 }} />
          {days.map((d) => (
            <div key={d} style={{ background: STYLES.brass + "22", borderBottom: `1px solid ${STYLES.ink}1a`, borderLeft: `1px solid ${STYLES.ink}1a`, padding: "8px 8px", fontSize: 12, fontWeight: 700 }}>
              {formatET(d + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })}
            </div>
          ))}
          {TIMEBLOCKS.map((block) => (
            <CalendarRow key={block.value} block={block} days={days} meetTasks={meetTasks} events={events} isHover={isHover} draggingId={draggingId} onToggle={onToggle} onEdit={onEdit} onGripDown={onGripDown} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: STYLES.slate }}>Tip: press and hold the grip (⋮) on a task, then drag it to another day or time of day. Tap the pencil to pick a day & time instead.</div>

      {drag && (
        <div style={{ position: "fixed", left: drag.x + 8, top: drag.y + 8, zIndex: 1000, pointerEvents: "none", background: STYLES.wax, color: "#fff", fontSize: 12, padding: "5px 9px", borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", maxWidth: 200 }}>
          {drag.task.title}
        </div>
      )}
    </div>
  );
}

function CalendarRow({ block, days, meetTasks, events, isHover, draggingId, onToggle, onEdit, onGripDown }) {
  return (
    <>
      <div style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", borderTop: `1px solid ${STYLES.ink}1a`, padding: "8px 6px", fontSize: 10, fontWeight: 700, color: STYLES.slate, textTransform: "uppercase", letterSpacing: 0.3, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        {BLOCK_ICON[block.value]}
        <span>{block.label}</span>
      </div>
      {days.map((d) => {
        const cellTasks = meetTasks.filter((t) => t.raptrmeetDay === d && t.raptrmeetTimeblock === block.value);
        const cellEvents = events.filter((e) => eventCoversDay(e, d) && timeBlockOfEvent(e) === block.value);
        const hot = isHover(d, block.value);
        return (
          <div key={d} data-drop-day={d} data-drop-block={block.value} style={{ borderTop: `1px solid ${STYLES.ink}1a`, borderLeft: `1px solid ${STYLES.ink}1a`, padding: 6, minHeight: 84, display: "flex", flexDirection: "column", gap: 4, background: hot ? STYLES.brass + "33" : "transparent", outline: hot ? `2px solid ${STYLES.wax}` : "none", outlineOffset: -2 }}>
            {cellEvents.map((e) => <EventLine key={e.id} e={e} />)}
            {cellTasks.map((t) => <TaskChip key={t.id} t={t} onToggle={onToggle} onEdit={onEdit} onGripDown={onGripDown} dragging={draggingId === t.id} />)}
          </div>
        );
      })}
    </>
  );
}

export default function TimelineTab({ meet, tasks, events, currentUser, onUpdateTask, onUpdateMeet, setError }) {
  const days = dateRange(meet.startDate, meet.endDate);
  const [view, setView] = useState("list");
  const [openDays, setOpenDays] = useState(() => new Set([days.includes(todayStr()) ? todayStr() : days[0]]));
  const [pickerTaskId, setPickerTaskId] = useState(null);
  // Optimistic placement so drops feel instant; cleared once the server copy
  // of the task matches, or if the save fails.
  const [pending, setPending] = useState({});

  useEffect(() => {
    setPending((p) => {
      const keys = Object.keys(p);
      if (keys.length === 0) return p;
      let changed = false;
      const next = { ...p };
      for (const id of keys) {
        const t = tasks.find((x) => x.id === id);
        if (!t || ((t.raptrmeetDay || null) === p[id].raptrmeetDay && (t.raptrmeetTimeblock || null) === p[id].raptrmeetTimeblock)) { delete next[id]; changed = true; }
      }
      return changed ? next : p;
    });
  }, [tasks]);

  const meetTasks = useMemo(
    () => tasks.filter((t) => t.raptrmeetId === meet.id).map((t) => (pending[t.id] ? { ...t, ...pending[t.id] } : t)),
    [tasks, meet.id, pending]
  );
  const unscheduled = meetTasks.filter((t) => !t.completed && !t.raptrmeetDay);

  function toggleDay(d) {
    setOpenDays((s) => { const next = new Set(s); next.has(d) ? next.delete(d) : next.add(d); return next; });
  }

  async function scheduleTask(taskId, day, timeblock) {
    const patch = { raptrmeetDay: day || null, raptrmeetTimeblock: day ? (timeblock || null) : null };
    setPending((p) => ({ ...p, [taskId]: patch }));
    setPickerTaskId(null);
    try { await onUpdateTask(taskId, patch); } catch (e) {
      setPending((p) => { const n = { ...p }; delete n[taskId]; return n; });
      setError("Couldn't schedule task: " + e.message);
    }
  }
  const moveTask = useCallback((t, target) => {
    if (target.unscheduled) { if (t.raptrmeetDay) scheduleTask(t.id, null, null); return; }
    if (t.raptrmeetDay === target.day && t.raptrmeetTimeblock === target.block) return;
    scheduleTask(t.id, target.day, target.block);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUpdateTask]);
  async function toggleTask(t) {
    try { await onUpdateTask(t.id, { completed: !t.completed }); } catch (e) { setError("Couldn't update task: " + e.message); }
  }

  function mealFor(date, mealType) {
    return (meet.meals || []).find((m) => m.date === date && m.mealType === mealType);
  }

  const pickerTask = pickerTaskId ? meetTasks.find((t) => t.id === pickerTaskId) : null;
  const viewBtn = (key, label, icon) => (
    <button onClick={() => setView(key)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", border: `1px solid ${STYLES.wax}`, background: view === key ? STYLES.wax : "#fff", color: view === key ? "#fff" : STYLES.wax, fontWeight: 600, borderRadius: key === "list" ? "4px 0 0 4px" : "0 4px 4px 0" }}>{icon} {label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ display: "flex" }}>{viewBtn("list", "List", <List size={13} />)}{viewBtn("calendar", "Calendar", <CalendarDays size={13} />)}</div>
      </div>

      {view === "calendar" && pickerTask && (
        <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Schedule: {pickerTask.title}</div>
          <DayTimeblockPicker key={pickerTask.id} days={days} initialDay={pickerTask.raptrmeetDay} initialBlock={pickerTask.raptrmeetTimeblock}
            onPick={(d, b) => scheduleTask(pickerTask.id, d, b)} onCancel={() => setPickerTaskId(null)}
            onClear={pickerTask.raptrmeetDay ? () => scheduleTask(pickerTask.id, null, null) : undefined} />
        </div>
      )}

      {view === "calendar" ? (
        <CalendarView days={days} meetTasks={meetTasks} unscheduled={unscheduled} events={events} onMove={moveTask} onToggle={toggleTask} onEdit={(t) => setPickerTaskId(t.id)} />
      ) : (
        <>
      {unscheduled.length > 0 && (
        <section style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: STYLES.ink, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Unscheduled RAPTRMeet tasks — assign a day & time</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {unscheduled.map((t) => (
              <li key={t.id} style={{ background: STYLES.ink + "06", borderRadius: 4, padding: "6px 9px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                  <span style={{ flex: "1 1 140px" }}>{t.title}</span>
                  <button onClick={() => setPickerTaskId((id) => (id === t.id ? null : t.id))} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "5px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                    <CalendarClock size={13} /> Schedule
                  </button>
                </div>
                {pickerTaskId === t.id && (
                  <DayTimeblockPicker days={days} onPick={(d, b) => scheduleTask(t.id, d, b)} onCancel={() => setPickerTaskId(null)} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {days.map((d) => {
        const isOpen = openDays.has(d);
        const dayEvents = events.filter((e) => eventCoversDay(e, d));
        const allDayEvents = dayEvents.filter((e) => e.allDay || !e.time);
        return (
          <section key={d} style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, overflow: "hidden" }}>
            <button onClick={() => toggleDay(d)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: STYLES.brass + "22", border: "none", padding: "12px 14px", cursor: "pointer", fontSize: 14, fontWeight: 700, textAlign: "left" }}>
              <span>{formatET(d + "T12:00:00", { weekday: "long", month: "short", day: "numeric" })}</span>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {isOpen && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {allDayEvents.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {allDayEvents.map((e) => <EventLine key={e.id} e={e} />)}
                  </div>
                )}
                {TIMEBLOCKS.map((block) => (
                  <div key={block.value}>
                    <TimeBlockSection
                      block={block}
                      dayEvents={dayEvents.filter((e) => timeBlockOfEvent(e) === block.value)}
                      dayTasks={meetTasks.filter((t) => t.raptrmeetDay === d && t.raptrmeetTimeblock === block.value)}
                      onToggleTask={toggleTask}
                      pickerTaskId={pickerTaskId}
                      onEditTask={(t) => setPickerTaskId((id) => (id === t.id ? null : t.id))}
                      renderPicker={(t) => (
                        <DayTimeblockPicker key={t.id} days={days} initialDay={t.raptrmeetDay} initialBlock={t.raptrmeetTimeblock}
                          onPick={(nd, nb) => scheduleTask(t.id, nd, nb)} onCancel={() => setPickerTaskId(null)}
                          onClear={() => scheduleTask(t.id, null, null)} />
                      )}
                    />
                    <MealLine meal={mealFor(d, MEAL_AFTER_BLOCK[block.value])} label={MEAL_AFTER_BLOCK[block.value]} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
        </>
      )}
    </div>
  );
}

function EventLine({ e }) {
  return (
    <div style={{ fontSize: 13, background: STYLES.ink + "06", borderRadius: 4, padding: "6px 9px" }}>
      {e.allDay || !e.time ? e.title : `${formatClockTime(e.time)} — ${e.title}`}
    </div>
  );
}

function MealLine({ meal, label }) {
  if (!meal || !meal.menu) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, background: STYLES.amber + "14", borderLeft: `3px solid ${STYLES.amber}`, borderRadius: 4, padding: "7px 10px", margin: "4px 0" }}>
      <UtensilsCrossed size={13} color={STYLES.amber} style={{ marginTop: 2, flexShrink: 0 }} />
      <div><strong>{label}:</strong> {meal.menu}</div>
    </div>
  );
}

function TimeBlockSection({ block, dayEvents, dayTasks, onToggleTask, pickerTaskId, onEditTask, renderPicker }) {
  const hasContent = dayEvents.length > 0 || dayTasks.length > 0;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: STYLES.slate, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        {BLOCK_ICON[block.value]} {block.label}
      </div>
      {!hasContent ? (
        <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 4 }}>Nothing planned.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {dayEvents.map((e) => <EventLine key={e.id} e={e} />)}
          {dayTasks.map((t) => (
            <div key={t.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "#fff", border: `1px solid ${STYLES.ink}14`, borderRadius: 4, padding: "6px 9px" }}>
                <button onClick={() => onToggleTask(t)} style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${t.completed ? STYLES.brass : STYLES.slate}`, background: t.completed ? STYLES.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  {t.completed && <Check size={11} color="#fff" />}
                </button>
                <span style={{ flex: 1, textDecoration: t.completed ? "line-through" : "none", opacity: t.completed ? 0.55 : 1 }}>{t.title}</span>
                <button onClick={() => onEditTask(t)} title="Edit schedule" style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, flexShrink: 0 }}>
                  <Pencil size={12} /> Edit
                </button>
              </div>
              {pickerTaskId === t.id && renderPicker(t)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
