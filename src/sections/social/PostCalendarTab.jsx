import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { STYLES, selectStyle, todayStr, formatClockTime } from "../../constants";
import { POST_TYPES, STATUS_LABEL, STATUS_TEXT_COLOR, typeColor } from "./socialConstants";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // same week start as the main calendar
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MAX_VISIBLE = 3;

function PostChip({ post, picked, moveMode, onOpen, onPick, onDragStart }) {
  const color = typeColor(post.postType);
  const time = post.publishTime ? `${formatClockTime(post.publishTime).replace(":00", "").replace(" ", "").toLowerCase()} ` : "";
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", post.id); e.dataTransfer.effectAllowed = "move"; onDragStart(post.id); }}
      onClick={(e) => { e.stopPropagation(); if (moveMode) onPick(post.id); else onOpen(post); }}
      title={`${post.title} · ${post.postType} · ${STATUS_LABEL[post.status]}`}
      style={{ fontSize: 10, fontWeight: 600, background: `${color}22`, borderLeft: `2px solid ${color}`, color: STATUS_TEXT_COLOR[post.status] || STYLES.ink, borderRadius: 3, padding: "1px 4px", marginBottom: 2, cursor: moveMode ? "pointer" : "grab", wordBreak: "break-word", whiteSpace: "normal", outline: picked ? `2px solid ${STYLES.ink}` : "none" }}
    >
      {time}{post.title}
    </div>
  );
}

// Month view of every dated post, laid out like the main calendar: seven equal columns that never
// scroll sideways. Drag a post to another day to move it (its time stays). Touch screens can't use
// drag-and-drop, so "Tap to move" lets you tap a post, then tap a day.
export default function PostCalendarTab({ posts, onOpenPost, onMovePost }) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [typeFilter, setTypeFilter] = useState("all");
  const [moveMode, setMoveMode] = useState(false);
  const [pickedId, setPickedId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overDay, setOverDay] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});

  const visible = useMemo(() => posts.filter((p) => typeFilter === "all" || p.postType === typeFilter), [posts, typeFilter]);
  const byDay = useMemo(() => {
    const m = {};
    visible.filter((p) => p.publishDate).forEach((p) => { (m[p.publishDate] = m[p.publishDate] || []).push(p); });
    Object.values(m).forEach((list) => list.sort((a, b) => (a.publishTime || "").localeCompare(b.publishTime || "") || a.title.localeCompare(b.title)));
    return m;
  }, [visible]);
  const undated = visible.filter((p) => !p.publishDate);
  const postById = useMemo(() => Object.fromEntries(posts.map((p) => [p.id, p])), [posts]);

  // Whole weeks, Monday to Sunday, like the main calendar (days outside the month are greyed).
  const monthStart = new Date(cursor.y, cursor.m, 1);
  const monthEnd = new Date(cursor.y, cursor.m + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + ((7 - monthEnd.getDay()) % 7));
  const days = [];
  for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) days.push(ymd(d));

  const shift = (delta) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function dropOn(day, id) {
    setOverDay(null);
    setDragId(null);
    const post = postById[id];
    if (!post || !day || post.publishDate === day) return;
    onMovePost(post, day);
    setPickedId(null);
  }

  return (
    <div style={{ padding: "16px 12px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => shift(-1)} aria-label="Previous month" style={{ ...selectStyle(), cursor: "pointer", display: "flex" }}><ChevronLeft size={16} /></button>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 18, minWidth: 150, textAlign: "center" }}>{monthLabel}</div>
        <button onClick={() => shift(1)} aria-label="Next month" style={{ ...selectStyle(), cursor: "pointer", display: "flex" }}><ChevronRight size={16} /></button>
        <button onClick={() => setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })} style={{ ...selectStyle(), cursor: "pointer" }}>Today</button>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle()}>
          <option value="all">All types</option>
          {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => { setMoveMode(!moveMode); setPickedId(null); }} style={{ ...selectStyle(), cursor: "pointer", display: "flex", alignItems: "center", gap: 5, background: moveMode ? STYLES.wax : undefined, color: moveMode ? STYLES.parchment : undefined, fontWeight: 600 }}><Hand size={13} /> Tap to move</button>
      </div>

      {moveMode && (
        <div style={{ fontSize: 12.5, color: STYLES.slate, marginBottom: 8 }}>
          {pickedId ? `Moving "${postById[pickedId]?.title}". Tap the day to move it to.` : "Tap a post to pick it up, then tap a day. Tap “Tap to move” again to go back to opening posts."}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: STYLES.slate, marginBottom: 8, alignItems: "center" }}>
        {POST_TYPES.map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 9, height: 9, background: typeColor(t), borderRadius: 2 }} />{t}</span>)}
      </div>
      <div style={{ fontSize: 11, color: STYLES.slate, marginBottom: 8 }}>
        Text color: <b style={{ color: "#2E7D32" }}>scheduled / live</b> · <b style={{ color: "#1F5FBF" }}>drafted / edited / ready to post</b> · <b style={{ color: "#C26A00" }}>idea / planned / filmed</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: STYLES.ink + "22", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, overflow: "hidden" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ background: STYLES.brass + "33", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "6px 0", color: STYLES.ink }}>{w}</div>
        ))}
        {days.map((day) => {
          const items = byDay[day] || [];
          const inMonth = Number(day.slice(5, 7)) - 1 === cursor.m;
          const isToday = day === today;
          const over = overDay === day;
          const showAll = expandedDays[day];
          const shown = showAll ? items : items.slice(0, MAX_VISIBLE);
          return (
            <div
              key={day}
              onDragOver={(e) => { e.preventDefault(); setOverDay(day); }}
              onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
              onDrop={(e) => { e.preventDefault(); dropOn(day, e.dataTransfer.getData("text/plain") || dragId); }}
              onClick={() => { if (moveMode && pickedId) dropOn(day, pickedId); }}
              style={{ background: over ? `${STYLES.brass}44` : inMonth ? "#fff" : STYLES.gray, minHeight: 88, minWidth: 0, padding: 6, opacity: inMonth ? 1 : 0.6, overflow: "hidden", cursor: moveMode && pickedId ? "copy" : "default" }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? STYLES.wax : STYLES.ink, marginBottom: 3 }}>{Number(day.slice(8, 10))}</div>
              {shown.map((p) => <PostChip key={p.id} post={p} picked={pickedId === p.id} moveMode={moveMode} onOpen={onOpenPost} onPick={setPickedId} onDragStart={setDragId} />)}
              {items.length > MAX_VISIBLE && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedDays((m) => ({ ...m, [day]: !m[day] })); }} style={{ background: "transparent", border: "none", padding: 0, fontSize: 10, color: STYLES.slate, cursor: "pointer", textDecoration: "underline" }}>
                  {showAll ? "Show less" : `+${items.length - MAX_VISIBLE} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.slate, marginBottom: 6 }}>Unscheduled ({undated.length}). Drag one onto a day to give it a date.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 4 }}>
            {undated.map((p) => <PostChip key={p.id} post={p} picked={pickedId === p.id} moveMode={moveMode} onOpen={onOpenPost} onPick={setPickedId} onDragStart={setDragId} />)}
          </div>
        </div>
      )}
    </div>
  );
}
