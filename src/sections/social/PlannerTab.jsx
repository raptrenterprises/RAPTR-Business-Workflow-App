import { useState, useMemo } from "react";
import { Plus, Search, ChevronRight, ChevronDown } from "lucide-react";
import { STYLES, selectStyle, formatClockTime } from "../../constants";
import { EmptyMsg } from "../../components/Shared";
import { POST_TYPES, STATUS_LABEL, STATUS_COLOR, nextStatuses, formatPostDate } from "./socialConstants";

const ALL_STATUSES = ["idea", "planned", "filmed", "drafted", "edited", "scheduled", "ready_to_post", "live"];

function StatusPill({ status }) {
  const c = STATUS_COLOR[status] || STYLES.slate;
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: c, border: `1px solid ${c}66`, background: `${c}14`, padding: "2px 9px", borderRadius: 10, whiteSpace: "nowrap" }}>{STATUS_LABEL[status] || status}</span>;
}

function PostCard({ post, shotCount, shotDone, campaignName, onOpen, onAdvance }) {
  const nexts = nextStatuses(post.postType, post.status);
  const when = post.publishDate ? `${formatPostDate(post.publishDate)}${post.publishTime ? ` · ${formatClockTime(post.publishTime)}` : ""}` : "No date yet";
  return (
    <div onClick={() => onOpen(post)} style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderLeft: `4px solid ${STATUS_COLOR[post.status] || STYLES.slate}`, borderRadius: 6, padding: "10px 12px", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, wordBreak: "break-word" }}>{post.title}</div>
        <div style={{ fontSize: 12.5, color: STYLES.slate, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>{post.postType}</span>
          <span>{when}</span>
          {campaignName && <span style={{ color: STYLES.purple }}>{campaignName}</span>}
          {shotCount > 0 && <span>{shotDone}/{shotCount} shots</span>}
        </div>
      </div>
      <StatusPill status={post.status} />
      {nexts.map((n) => (
        <button key={n} onClick={(e) => { e.stopPropagation(); onAdvance(post, n); }} style={{ ...selectStyle(), cursor: "pointer", display: "flex", alignItems: "center", gap: 3, color: STATUS_COLOR[n], fontWeight: 600 }}>
          {STATUS_LABEL[n]} <ChevronRight size={13} />
        </button>
      ))}
    </div>
  );
}

function sortByDate(a, b) {
  if (!a.publishDate && !b.publishDate) return a.title.localeCompare(b.title);
  if (!a.publishDate) return 1;
  if (!b.publishDate) return -1;
  return `${a.publishDate} ${a.publishTime}` < `${b.publishDate} ${b.publishTime}` ? -1 : 1;
}

export default function PlannerTab({ posts, shots, campaigns, onOpenPost, onAdvance }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [showLive, setShowLive] = useState(false);

  const campaignName = useMemo(() => Object.fromEntries(campaigns.map((c) => [c.id, c.name])), [campaigns]);
  const shotStats = useMemo(() => {
    const m = {};
    shots.forEach((s) => { const e = (m[s.postId] = m[s.postId] || { total: 0, done: 0 }); e.total += 1; if (s.completed) e.done += 1; });
    return m;
  }, [shots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (typeFilter !== "all" && p.postType !== typeFilter) return false;
      if (campaignFilter === "none" ? p.campaignId : campaignFilter !== "all" && p.campaignId !== campaignFilter) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
      if (q && !`${p.title} ${p.description} ${p.caption} ${p.notes} ${p.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort(sortByDate);
  }, [posts, search, statusFilter, typeFilter, campaignFilter]);

  const active = filtered.filter((p) => p.status !== "live");
  const live = filtered.filter((p) => p.status === "live");
  const liveVisible = showLive || statusFilter.includes("live");
  const toggleStatus = (s) => setStatusFilter((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const filtersActive = search || statusFilter.length > 0 || typeFilter !== "all" || campaignFilter !== "all";
  const renderCard = (p) => <PostCard key={p.id} post={p} shotCount={shotStats[p.id]?.total || 0} shotDone={shotStats[p.id]?.done || 0} campaignName={campaignName[p.campaignId]} onOpen={onOpenPost} onAdvance={onAdvance} />;

  return (
    <div style={{ padding: "16px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => onOpenPost(null)} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> New post
        </button>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 9, top: 10, color: STYLES.slate }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts" style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 8px 8px 28px" }} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle()}>
          <option value="all">All types</option>
          {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} style={selectStyle()}>
          <option value="all">All campaigns</option>
          <option value="none">No campaign</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: STYLES.slate }}>Status</span>
        {ALL_STATUSES.map((s) => {
          const on = statusFilter.includes(s);
          const c = STATUS_COLOR[s];
          return <button key={s} onClick={() => toggleStatus(s)} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${on ? c : STYLES.ink + "33"}`, background: on ? c : "#fff", color: on ? "#fff" : STYLES.ink, fontWeight: on ? 600 : 400 }}>{STATUS_LABEL[s]}</button>;
        })}
        {filtersActive && <button onClick={() => { setSearch(""); setStatusFilter([]); setTypeFilter("all"); setCampaignFilter("all"); }} style={{ background: "transparent", border: "none", color: STYLES.wax, cursor: "pointer", textDecoration: "underline", fontSize: 12.5 }}>Clear filters</button>}
      </div>

      {posts.length === 0 ? (
        <EmptyMsg>No posts yet. Tap “New post” to plan the first one.</EmptyMsg>
      ) : filtered.length === 0 ? (
        <EmptyMsg>Nothing matches those filters.</EmptyMsg>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.length === 0 ? <EmptyMsg>Nothing in progress. Everything here is already live.</EmptyMsg> : active.map(renderCard)}
          </div>
          {live.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <button onClick={() => setShowLive(!showLive)} style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate, fontSize: 13.5, display: "flex", alignItems: "center", gap: 4, padding: 0, marginBottom: 8 }}>
                {liveVisible ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Live ({live.length})
              </button>
              {liveVisible && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{live.slice().reverse().map(renderCard)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
