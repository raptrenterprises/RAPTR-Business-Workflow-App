import { useState, useMemo } from "react";
import { Plus, X, Trash2, CalendarCheck } from "lucide-react";
import { STYLES, uid, selectStyle, dateRange, eventCoversDay, formatET, formatClockTime, EVENT_CATEGORY_COLOR } from "../../constants";

const emptyDraft = (date) => ({ title: "", date, time: "", allDay: true, description: "" });

export default function ActivitiesTab({ meet, events, currentUser, onInsertEvent, onUpdateEvent, onDeleteEvent, setError }) {
  const days = dateRange(meet.startDate, meet.endDate);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft(meet.startDate));

  const dayEvents = useMemo(() => {
    const map = {};
    days.forEach((d) => { map[d] = events.filter((e) => eventCoversDay(e, d)); });
    return map;
  }, [events, days]);

  async function addActivity() {
    const title = draft.title.trim();
    if (!title) return;
    const ev = {
      id: uid(), title, description: draft.description.trim(), category: "RAPTRMeet",
      date: draft.date, endDate: draft.date, time: draft.allDay ? null : draft.time || null, allDay: draft.allDay,
      recurrence: "none", recurrenceEnd: null, createdBy: currentUser, createdAt: new Date().toISOString(), attachments: [],
    };
    setComposing(false);
    setDraft(emptyDraft(meet.startDate));
    try { await onInsertEvent(ev); } catch (e) { setError("Couldn't add activity: " + e.message); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, display: "flex", alignItems: "center", gap: 6 }}><CalendarCheck size={14} /> Planned Events & Activities</div>
        <button onClick={() => setComposing((c) => !c)} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
          <Plus size={14} /> Add activity
        </button>
      </div>
      <div style={{ fontSize: 11, color: STYLES.slate, marginTop: -10, fontStyle: "italic" }}>Pulled from the regular Calendar — anything scheduled during {meet.startDate} → {meet.endDate} shows up here automatically.</div>

      {composing && (
        <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14 }}>
          <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Activity title…" style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14, marginBottom: 10 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
              Day
              <select value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={selectStyle()}>
                {days.map((d) => <option key={d} value={d}>{formatET(d + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
              <input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} /> All day
            </label>
            {!draft.allDay && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
                Time <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={selectStyle()} />
              </label>
            )}
          </div>
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Notes (optional)" rows={2} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13, fontFamily: "inherit", resize: "vertical", marginBottom: 10 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={addActivity} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Add</button>
            <button onClick={() => setComposing(false)} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}><X size={14} /></button>
          </div>
        </div>
      )}

      {days.map((d) => (
        <div key={d} style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{formatET(d + "T12:00:00", { weekday: "long", month: "short", day: "numeric" })}</div>
          {dayEvents[d].length === 0 ? (
            <div style={{ fontSize: 13, color: STYLES.slate }}>Nothing scheduled.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dayEvents[d].map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: `${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}14`, borderLeft: `3px solid ${EVENT_CATEGORY_COLOR[e.category] || STYLES.brass}`, borderRadius: 4, padding: "7px 10px" }}>
                  <span style={{ flex: 1 }}>{e.allDay || !e.time ? e.title : `${formatClockTime(e.time)} — ${e.title}`}</span>
                  <span style={{ fontSize: 10, color: EVENT_CATEGORY_COLOR[e.category] || STYLES.slate, fontWeight: 700, flexShrink: 0 }}>{e.category}</span>
                  {e.category === "RAPTRMeet" && (
                    <button onClick={() => onDeleteEvent(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0 }}><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
