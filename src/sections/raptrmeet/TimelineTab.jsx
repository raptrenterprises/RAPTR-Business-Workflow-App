import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Check, Sunrise, Sun, Moon, UtensilsCrossed } from "lucide-react";
import { STYLES, todayStr, dateRange, eventCoversDay, formatET, formatClockTime, selectStyle, TIMEBLOCKS } from "../../constants";

const BLOCK_ICON = { morning: <Sunrise size={14} />, afternoon: <Sun size={14} />, evening: <Moon size={14} /> };
const MEAL_AFTER_BLOCK = { morning: "Breakfast", afternoon: "Lunch", evening: "Dinner" };

function timeBlockOfEvent(e) {
  if (e.allDay || !e.time) return null; // shown separately as "all day"
  const [h] = e.time.split(":").map(Number);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function TimelineTab({ meet, tasks, events, currentUser, onUpdateTask, onUpdateMeet, setError }) {
  const days = dateRange(meet.startDate, meet.endDate);
  const [openDays, setOpenDays] = useState(() => new Set([days.includes(todayStr()) ? todayStr() : days[0]]));

  const meetTasks = useMemo(() => tasks.filter((t) => t.raptrmeetId === meet.id), [tasks, meet.id]);
  const unscheduled = meetTasks.filter((t) => !t.completed && !t.raptrmeetDay);

  function toggleDay(d) {
    setOpenDays((s) => { const next = new Set(s); next.has(d) ? next.delete(d) : next.add(d); return next; });
  }

  async function scheduleTask(taskId, day, timeblock) {
    try { await onUpdateTask(taskId, { raptrmeetDay: day || null, raptrmeetTimeblock: timeblock || null }); } catch (e) { setError("Couldn't schedule task: " + e.message); }
  }
  async function toggleTask(t) {
    try { await onUpdateTask(t.id, { completed: !t.completed }); } catch (e) { setError("Couldn't update task: " + e.message); }
  }

  function mealFor(date, mealType) {
    return (meet.meals || []).find((m) => m.date === date && m.mealType === mealType);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {unscheduled.length > 0 && (
        <section style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: STYLES.ink, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Unscheduled RAPTRMeet tasks — assign a day & time</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {unscheduled.map((t) => (
              <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, background: STYLES.ink + "06", borderRadius: 4, padding: "6px 9px" }}>
                <span style={{ flex: "1 1 140px" }}>{t.title}</span>
                <select onChange={(e) => { const [d, b] = e.target.value.split("|"); if (d) scheduleTask(t.id, d, b); }} defaultValue="" style={selectStyle()}>
                  <option value="" disabled>Schedule…</option>
                  {days.map((d) => TIMEBLOCKS.map((b) => (
                    <option key={`${d}|${b.value}`} value={`${d}|${b.value}`}>{formatET(d + "T12:00:00", { month: "short", day: "numeric" })} · {b.label}</option>
                  )))}
                </select>
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
                    />
                    <MealLine meal={mealFor(d, MEAL_AFTER_BLOCK[block.value])} label={MEAL_AFTER_BLOCK[block.value]} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
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

function TimeBlockSection({ block, dayEvents, dayTasks, onToggleTask }) {
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
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "#fff", border: `1px solid ${STYLES.ink}14`, borderRadius: 4, padding: "6px 9px" }}>
              <button onClick={() => onToggleTask(t)} style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${t.completed ? STYLES.brass : STYLES.slate}`, background: t.completed ? STYLES.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {t.completed && <Check size={11} color="#fff" />}
              </button>
              <span style={{ textDecoration: t.completed ? "line-through" : "none", opacity: t.completed ? 0.55 : 1 }}>{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
