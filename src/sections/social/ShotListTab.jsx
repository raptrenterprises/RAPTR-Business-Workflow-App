import { useState, useMemo } from "react";
import { Search, Copy, Check } from "lucide-react";
import { STYLES, selectStyle, todayStr, addDays, formatClockTime } from "../../constants";
import { EmptyMsg } from "../../components/Shared";
import { MEDIA_PEOPLE, STATUS_LABEL, STATUS_COLOR, UNIT_NOUN, typeConfig, formatPostDate } from "./socialConstants";
import MediaPicker from "./MediaPicker";

const FORMATS = [{ value: "photo", label: "Photo" }, { value: "video", label: "Video" }, { value: "either", label: "Either" }];
const TIME_FRAMES = [
  { value: "all", label: "Any date" },
  { value: "7", label: "Due in next 7 days" },
  { value: "14", label: "Due in next 14 days" },
  { value: "30", label: "Due in next 30 days" },
  { value: "custom", label: "Custom range…" },
  { value: "undated", label: "No date yet" },
];

function Chip({ active, onClick, children, color }) {
  const c = color || STYLES.wax;
  return (
    <button type="button" onClick={onClick} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${active ? c : STYLES.ink + "33"}`, background: active ? c : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  );
}

function ShotLine({ shot, post, unitLabel, linked, showPost, onToggle, onFind }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6 }}>
      <input type="checkbox" checked={shot.completed} onChange={(e) => onToggle(shot, e.target.checked)} aria-label="Shot done" style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: STYLES.green }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, textDecoration: shot.completed ? "line-through" : "none", color: shot.completed ? STYLES.slate : STYLES.ink, wordBreak: "break-word" }}>{shot.description}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: STYLES.ink, border: `1px solid ${STYLES.ink}33`, borderRadius: 10, padding: "1px 7px" }}>{shot.mediaType === "photo" ? "Photo" : shot.mediaType === "video" ? "Video" : "Photo or video"}</span>
          {shot.people.map((p) => <span key={p} style={{ fontSize: 11, color: STYLES.blue, border: `1px solid ${STYLES.blue}55`, background: `${STYLES.blue}14`, borderRadius: 10, padding: "1px 7px" }}>{p}</span>)}
          {shot.tags.map((t) => <span key={t} style={{ fontSize: 11, color: STYLES.purple, border: `1px solid ${STYLES.purple}55`, background: `${STYLES.purple}14`, borderRadius: 10, padding: "1px 7px" }}>{t}</span>)}
          {unitLabel && <span style={{ fontSize: 11, fontWeight: 600, color: STYLES.slate, border: `1px solid ${STYLES.ink}33`, borderRadius: 10, padding: "1px 7px" }}>{unitLabel}</span>}
          {showPost && <span style={{ fontSize: 11.5, color: STYLES.slate }}>· {post.title}</span>}
        </div>
        {linked.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {linked.map((m) => (
              <span key={m.id} title={m.title} style={{ width: 34, height: 34, borderRadius: 4, overflow: "hidden", background: STYLES.gray, border: `1px solid ${STYLES.ink}33`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: STYLES.slate }}>
                {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt={m.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.mediaType}
              </span>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => onFind(shot)} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}><Search size={12} /> {linked.length > 0 ? "Media" : "Find"}</button>
    </div>
  );
}

function sortPosts(a, b) {
  if (!a.publishDate && !b.publishDate) return a.title.localeCompare(b.title);
  if (!a.publishDate) return 1;
  if (!b.publishDate) return -1;
  return `${a.publishDate} ${a.publishTime}` < `${b.publishDate} ${b.publishTime}` ? -1 : 1;
}

export default function ShotListTab({ posts, shots, units = [], campaigns, media, shotMedia, onOpenPost, onToggleShot, onSetShotMedia }) {
  const [timeFrame, setTimeFrame] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formatFilter, setFormatFilter] = useState([]);
  const [peopleFilter, setPeopleFilter] = useState([]);
  const [exact, setExact] = useState(false);
  const [tagFilter, setTagFilter] = useState([]);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [doneFilter, setDoneFilter] = useState("todo");
  const [includeLive, setIncludeLive] = useState(false);
  const [groupBy, setGroupBy] = useState("post");
  const [pickerShot, setPickerShot] = useState(null);
  const [copied, setCopied] = useState(false);

  const postById = useMemo(() => Object.fromEntries(posts.map((p) => [p.id, p])), [posts]);
  // "Slide 2" / "Beat 3" labels for shots that belong to a carousel slide or reel beat.
  const unitLabelById = useMemo(() => {
    const byPost = {};
    units.forEach((u) => { (byPost[u.postId] = byPost[u.postId] || []).push(u); });
    const labels = {};
    Object.entries(byPost).forEach(([postId, list]) => {
      const kind = typeConfig(postById[postId]?.postType).units;
      if (!kind) return;
      list.sort((a, b) => a.sortOrder - b.sortOrder).forEach((u, i) => { labels[u.id] = `${UNIT_NOUN[kind]} ${i + 1}`; });
    });
    return labels;
  }, [units, postById]);
  const mediaById = useMemo(() => Object.fromEntries(media.map((m) => [m.id, m])), [media]);
  const linksByShot = useMemo(() => {
    const m = {};
    shotMedia.forEach((l) => { (m[l.shotItemId] = m[l.shotItemId] || []).push(l.mediaId); });
    return m;
  }, [shotMedia]);

  // Tag chips come from every shot's own tags and its post's tags.
  const tagCounts = useMemo(() => {
    const counts = {};
    shots.forEach((s) => {
      const post = postById[s.postId];
      if (!post || (!includeLive && post.status === "live")) return;
      new Set([...s.tags, ...post.tags]).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [shots, postById, includeLive]);

  const rows = useMemo(() => {
    const today = todayStr();
    const limit = ["7", "14", "30"].includes(timeFrame) ? addDays(today, Number(timeFrame)) : null;
    return shots.filter((s) => {
      const post = postById[s.postId];
      if (!post) return false;
      if (!includeLive && post.status === "live") return false;
      if (campaignFilter !== "all" && (campaignFilter === "none" ? post.campaignId : post.campaignId !== campaignFilter)) return false;
      if (timeFrame === "undated" && post.publishDate) return false;
      if (limit && (!post.publishDate || post.publishDate > limit)) return false; // overdue posts still count
      if (timeFrame === "custom") {
        if (!post.publishDate) return false;
        if (from && post.publishDate < from) return false;
        if (to && post.publishDate > to) return false;
      }
      if (formatFilter.length > 0 && !formatFilter.includes(s.mediaType || "either")) return false;
      if (peopleFilter.length > 0) {
        if (!peopleFilter.every((p) => s.people.includes(p))) return false;
        if (exact && s.people.length !== peopleFilter.length) return false;
      }
      if (!tagFilter.every((t) => s.tags.includes(t) || post.tags.includes(t))) return false;
      if (doneFilter === "todo" && s.completed) return false;
      if (doneFilter === "done" && !s.completed) return false;
      return true;
    }).sort((a, b) => sortPosts(postById[a.postId], postById[b.postId]) || a.sortOrder - b.sortOrder);
  }, [shots, postById, includeLive, campaignFilter, timeFrame, from, to, formatFilter, peopleFilter, exact, tagFilter, doneFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((s) => {
      const post = postById[s.postId];
      const key = groupBy === "post" ? post.id : post.publishDate || "none";
      if (!map.has(key)) map.set(key, { key, post, items: [] });
      map.get(key).items.push(s);
    });
    return [...map.values()];
  }, [rows, groupBy, postById]);

  const toggleIn = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const counts = { photo: 0, video: 0, either: 0 };
  rows.forEach((s) => { counts[s.mediaType || "either"] += 1; });
  const postCount = new Set(rows.map((s) => s.postId)).size;
  const filtersActive = timeFrame !== "all" || formatFilter.length > 0 || peopleFilter.length > 0 || tagFilter.length > 0 || campaignFilter !== "all" || doneFilter !== "todo" || includeLive;
  const reset = () => { setTimeFrame("all"); setFrom(""); setTo(""); setFormatFilter([]); setPeopleFilter([]); setExact(false); setTagFilter([]); setCampaignFilter("all"); setDoneFilter("todo"); setIncludeLive(false); };

  async function copyList() {
    const lines = [`Shot list — ${rows.length} shots`];
    groups.forEach((g) => {
      const head = groupBy === "post" ? `${g.post.title}${g.post.publishDate ? ` (${formatPostDate(g.post.publishDate)})` : ""}` : g.post.publishDate ? formatPostDate(g.post.publishDate) : "No date yet";
      lines.push("", head);
      g.items.forEach((s) => {
        const meta = [s.mediaType === "photo" ? "photo" : s.mediaType === "video" ? "video" : "photo or video", ...s.people, ...s.tags].join(", ");
        lines.push(`${s.completed ? "[x]" : "[ ]"} ${s.description} (${meta})${groupBy === "date" ? ` — ${g.items.length ? postById[s.postId].title : ""}` : ""}`);
      });
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* clipboard blocked; nothing to do */ }
  }

  return (
    <div style={{ padding: "16px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <select value={timeFrame} onChange={(e) => setTimeFrame(e.target.value)} style={selectStyle()}>
          {TIME_FRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {timeFrame === "custom" && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle()} aria-label="From date" />
            <span style={{ fontSize: 12.5, color: STYLES.slate }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle()} aria-label="To date" />
          </>
        )}
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} style={selectStyle()}>
          <option value="all">All campaigns</option>
          <option value="none">No campaign</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={doneFilter} onChange={(e) => setDoneFilter(e.target.value)} style={selectStyle()}>
          <option value="todo">Still to shoot</option>
          <option value="done">Done</option>
          <option value="all">Done &amp; not done</option>
        </select>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={selectStyle()}>
          <option value="post">Group by post</option>
          <option value="date">Group by date</option>
        </select>
        <label style={{ fontSize: 12.5, color: STYLES.slate, display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={includeLive} onChange={(e) => setIncludeLive(e.target.checked)} /> Include live posts
        </label>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Format</span>
        {FORMATS.map((f) => <Chip key={f.value} active={formatFilter.includes(f.value)} onClick={() => toggleIn(formatFilter, setFormatFilter, f.value)}>{f.label}</Chip>)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Who's in it</span>
        {MEDIA_PEOPLE.map((p) => <Chip key={p} color={STYLES.blue} active={peopleFilter.includes(p)} onClick={() => toggleIn(peopleFilter, setPeopleFilter, p)}>{p}</Chip>)}
        {peopleFilter.length > 0 && (
          <label style={{ fontSize: 12.5, color: STYLES.slate, display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Only exactly these people
          </label>
        )}
      </div>
      {tagCounts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Tags</span>
          {tagCounts.map(([t, n]) => <Chip key={t} color={STYLES.purple} active={tagFilter.includes(t)} onClick={() => toggleIn(tagFilter, setTagFilter, t)}>{t} ({n})</Chip>)}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: STYLES.slate, margin: "12px 0 14px" }}>
        <span>{rows.length} {rows.length === 1 ? "shot" : "shots"} across {postCount} {postCount === 1 ? "post" : "posts"} · {counts.photo} photo, {counts.video} video, {counts.either} either</span>
        {filtersActive && <button onClick={reset} style={{ background: "transparent", border: "none", color: STYLES.wax, cursor: "pointer", textDecoration: "underline", fontSize: 12.5 }}>Reset filters</button>}
        {rows.length > 0 && (
          <button onClick={copyList} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy list</>}
          </button>
        )}
      </div>

      {shots.length === 0 ? (
        <EmptyMsg>No shots yet. Add a shot list to a post in the Planner and it will show up here.</EmptyMsg>
      ) : rows.length === 0 ? (
        <EmptyMsg>No shots match those filters.</EmptyMsg>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((g) => {
            const c = STATUS_COLOR[g.post.status];
            return (
              <div key={g.key}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  {groupBy === "post" ? (
                    <>
                      <button onClick={() => onOpenPost(g.post)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 16, color: STYLES.ink, textAlign: "left" }}>{g.post.title}</button>
                      <span style={{ fontSize: 12.5, color: STYLES.slate }}>{g.post.publishDate ? `${formatPostDate(g.post.publishDate)}${g.post.publishTime ? ` · ${formatClockTime(g.post.publishTime)}` : ""}` : "No date yet"}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: c, border: `1px solid ${c}66`, background: `${c}14`, padding: "1px 8px", borderRadius: 10 }}>{STATUS_LABEL[g.post.status]}</span>
                    </>
                  ) : (
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>{g.post.publishDate ? formatPostDate(g.post.publishDate) : "No date yet"}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {g.items.map((s) => (
                    <ShotLine key={s.id} shot={s} post={postById[s.postId]} unitLabel={s.unitId ? unitLabelById[s.unitId] : ""} showPost={groupBy === "date"} linked={(linksByShot[s.id] || []).map((id) => mediaById[id]).filter(Boolean)} onToggle={onToggleShot} onFind={setPickerShot} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerShot && (
        <MediaPicker
          media={media}
          initialSelected={linksByShot[pickerShot.id] || []}
          requirements={{ mediaType: pickerShot.mediaType, people: pickerShot.people, tags: pickerShot.tags }}
          shotLabel={pickerShot.description}
          onClose={() => setPickerShot(null)}
          onConfirm={(ids) => { onSetShotMedia(pickerShot.id, ids, linksByShot[pickerShot.id] || []); setPickerShot(null); }}
        />
      )}
    </div>
  );
}
