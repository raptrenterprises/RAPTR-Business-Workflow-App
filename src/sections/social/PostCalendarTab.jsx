import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { STYLES, selectStyle, todayStr, formatClockTime } from "../../constants";
import { POST_TYPES, STATUS_LABEL, STATUS_TEXT_COLOR, typeColor } from "./socialConstants";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function PostChip({ post, picked, moveMode, onOpen, onPick, onDragStart }) {
  const color = typeColor(post.postType);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", post.id); e.dataTransfer.effectAllowed = "move"; onDragStart(post.id); }}
      onClick={(e) => { e.stopPropagation(); if (moveMode) onPick(post.id); else onOpen(post); }}
      title={`${post.title} · ${post.postType} · ${STATUS_LABEL[post.status]}`}
      style={{ background: `${color}22`, borderLeft: `4px solid ${color}`, color: STATUS_TEXT_COLOR[post.status] || STYLES.ink, fontWeight: 600, fontSize: 11.5, lineHeight: 1.25, padding: "2px 5px", borderRadius: 3, cursor: moveMode ? "pointer" : "grab", outline: picked ? `2px solid ${STYLES.ink}` : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {post.publishTime ? `${formatClockTime(post.publishTime).replace(":00", "").replace(" ", "").toLowerCase()} ` : ""}{post.title}
    </div>
  );
}

// Month view of every dated post. Drag a post onto another day to move it (its time stays the same).
// Browsers don't support drag-and-drop by touch, so "Tap to move" lets you tap a post, then tap a day.
export default function PostCalendarTab({ posts, onOpenPost, onMovePost }) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [typeFilter, setTypeFilter] = useState("all");
  const [moveMode, setMoveMode] = useState(false);
  const [pickedId, setPickedId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const visible = useMemo(() => posts.filter((p) => typeFilter === "all" || p.postType === typeFilter), [posts, typeFilter]);
  const byDay = useMemo(() => {
    const m = {};
    visible.filter((p) => p.publishDate).forEach((p) => { (m[p.publishDate] = m[p.publishDate] || []).push(p); });
    Object.values(m).forEach((list) => list.sort((a, b) => (a.publishTime || "").localeCompare(b.publishTime || "") || a.title.localeCompare(b.title)));
    return m;
  }, [visible]);
  const undated = visible.filter((p) => !p.publishDate);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(cursor.y, cursor.m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const postById = useMemo(() => Object.fromEntries(posts.map((p) => [p.id, p])), [posts]);

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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: STYLES.slate, marginBottom: 8, alignItems: "center" }}>
        {POST_TYPES.map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: typeColor(t), borderRadius: 2 }} />{t}</span>)}
        <span style={{ marginLeft: "auto" }}>Text: <b style={{ color: "#2E7D32" }}>scheduled/live</b> · <b style={{ color: "#1F5FBF" }}>drafted/edited/ready to post</b> · <b style={{ color: "#C26A00" }}>idea/planned/filmed</b></span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: `${STYLES.ink}22`, border: `1px solid ${STYLES.ink}22`, borderBottom: "none" }}>
            {DOW.map((d) => <div key={d} style={{ background: STYLES.parchment, padding: "4px 6px", fontSize: 12, fontWeight: 700, color: STYLES.slate }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: `${STYLES.ink}22`, border: `1px solid ${STYLES.ink}22` }}>
            {cells.map((day, i) => {
              const items = day ? byDay[day] || [] : [];
              const isToday = day === today;
              const over = overDay === day && day;
              return (
                <div
                  key={i}
                  onDragOver={(e) => { if (day) { e.preventDefault(); setOverDay(day); } }}
                  onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
                  onDrop={(e) => { e.preventDefault(); dropOn(day, e.dataTransfer.getData("text/plain") || dragId); }}
                  onClick={() => { if (moveMode && pickedId && day) dropOn(day, pickedId); }}
                  style={{ background: over ? `${STYLES.brass}33` : day ? "#fff" : `${STYLES.ink}08`, minHeight: 92, padding: 4, display: "flex", flexDirection: "column", gap: 3, cursor: moveMode && pickedId && day ? "copy" : "default" }}
                >
                  {day && <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? "#fff" : STYLES.slate, background: isToday ? STYLES.wax : "transparent", borderRadius: 10, padding: isToday ? "0 6px" : 0, alignSelf: "flex-start" }}>{Number(day.slice(8))}</div>}
                  {items.map((p) => <PostChip key={p.id} post={p} picked={pickedId === p.id} moveMode={moveMode} onOpen={onOpenPost} onPick={setPickedId} onDragStart={setDragId} />)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.slate, marginBottom: 6 }}>Unscheduled ({undated.length}). Drag one onto a day to give it a date.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {undated.map((p) => <div key={p.id} style={{ maxWidth: 240 }}><PostChip post={p} picked={pickedId === p.id} moveMode={moveMode} onOpen={onOpenPost} onPick={setPickedId} onDragStart={setDragId} /></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
