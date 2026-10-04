import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Image as ImageIcon, Video, ExternalLink, Search } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { CenterMsg, EmptyMsg, ErrorBar } from "../../components/Shared";
import { fetchMedia, insertMedia, updateMedia, deleteMediaRow, subscribeMedia } from "../../lib/mediaApi";
import { deleteAttachment } from "../../lib/storageApi";
import { MEDIA_TYPES, ASSET_KINDS, POST_FORMATS, MEDIA_PEOPLE } from "./socialConstants";
import MediaForm from "./MediaForm";

function FilterChip({ active, onClick, children, color }) {
  const c = color || STYLES.wax;
  return (
    <button type="button" onClick={onClick} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${active ? c : STYLES.ink + "33"}`, background: active ? c : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  );
}

function MediaCard({ item, onOpen }) {
  const Icon = item.mediaType === "video" ? Video : ImageIcon;
  return (
    <div onClick={() => onOpen(item)} style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: STYLES.gray, display: "flex", alignItems: "center", justifyContent: "center", color: STYLES.slate }}>
        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon size={32} />}
        <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, padding: "2px 7px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon size={11} /> {item.assetKind === "finished" ? item.postFormat || "Finished" : item.mediaType === "video" ? "Video" : "Photo"}
        </span>
        {item.isAi && <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>AI</span>}
        {item.sourceUrl && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Open in OneDrive" style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.9)", color: STYLES.ink, borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{item.title}</div>
        {(item.people.length > 0 || item.tags.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {item.people.map((p) => <span key={p} style={{ fontSize: 11, color: STYLES.blue, border: `1px solid ${STYLES.blue}55`, background: `${STYLES.blue}14`, borderRadius: 10, padding: "1px 7px" }}>{p}</span>)}
            {item.tags.map((t) => <span key={t} style={{ fontSize: 11, color: STYLES.purple, border: `1px solid ${STYLES.purple}55`, background: `${STYLES.purple}14`, borderRadius: 10, padding: "1px 7px" }}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaLibraryTab({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [aiFilter, setAiFilter] = useState("all");
  const [peopleFilter, setPeopleFilter] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);

  const reload = useCallback(async () => {
    try { setItems(await fetchMedia()); setError(""); } catch (e) { setError("Couldn't load the media library: " + e.message); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    return subscribeMedia(reload);
  }, [reload]);

  // Every tag in use, most-used first, so filter chips and suggestions stay in sync with the data.
  const tagCounts = useMemo(() => {
    const counts = {};
    items.forEach((i) => i.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);
  const allTags = useMemo(() => tagCounts.map(([t]) => t), [tagCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter !== "all" && i.mediaType !== typeFilter) return false;
      if (kindFilter !== "all" && i.assetKind !== kindFilter) return false;
      if (formatFilter !== "all" && i.postFormat !== formatFilter) return false;
      if (aiFilter === "ai" && !i.isAi) return false;
      if (aiFilter === "real" && i.isAi) return false;
      if (!peopleFilter.every((p) => i.people.includes(p))) return false;
      if (!tagFilter.every((t) => i.tags.includes(t))) return false;
      if (q && !`${i.title} ${i.fileName} ${i.notes} ${i.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, typeFilter, kindFilter, formatFilter, aiFilter, peopleFilter, tagFilter]);

  const filtersActive = search || typeFilter !== "all" || kindFilter !== "all" || formatFilter !== "all" || aiFilter !== "all" || peopleFilter.length > 0 || tagFilter.length > 0;
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setKindFilter("all"); setFormatFilter("all"); setAiFilter("all"); setPeopleFilter([]); setTagFilter([]); };
  const toggleIn = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function handleSave(data, isNew) {
    if (isNew) await insertMedia({ ...data, createdBy: currentUser, createdAt: new Date().toISOString() });
    else await updateMedia(data.id, data);
    setEditing(null);
    reload();
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.title}" from the library? The file in OneDrive is not touched.`)) return;
    try {
      await deleteMediaRow(item.id);
      if (item.thumbnailPath) { try { await deleteAttachment(item.thumbnailPath); } catch (_) { /* already gone */ } }
      setEditing(null);
      reload();
    } catch (e) {
      setError("Couldn't delete: " + e.message);
    }
  }

  if (loading) return <CenterMsg>Loading media library…</CenterMsg>;

  return (
    <div>
      <ErrorBar>{error}</ErrorBar>
      <div style={{ padding: "16px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <button onClick={() => setEditing("new")} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Add media
          </button>
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 10, color: STYLES.slate }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, file name, notes, tags" style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", paddingLeft: 28, fontSize: 14, padding: "8px 8px 8px 28px" }} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle()}>
            <option value="all">Photos &amp; videos</option>
            {MEDIA_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}s only</option>)}
          </select>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={selectStyle()}>
            <option value="all">Raw &amp; finished</option>
            {ASSET_KINDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={aiFilter} onChange={(e) => setAiFilter(e.target.value)} style={selectStyle()}>
            <option value="all">AI &amp; not AI</option>
            <option value="ai">AI only</option>
            <option value="real">Not AI</option>
          </select>
          {kindFilter !== "raw" && (
            <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} style={selectStyle()}>
              <option value="all">All post formats</option>
              {POST_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Who's in it</span>
          {MEDIA_PEOPLE.map((p) => <FilterChip key={p} active={peopleFilter.includes(p)} color={STYLES.blue} onClick={() => toggleIn(peopleFilter, setPeopleFilter, p)}>{p}</FilterChip>)}
        </div>
        {tagCounts.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Tags</span>
            {tagCounts.map(([t, n]) => <FilterChip key={t} active={tagFilter.includes(t)} color={STYLES.purple} onClick={() => toggleIn(tagFilter, setTagFilter, t)}>{t} ({n})</FilterChip>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12.5, color: STYLES.slate, margin: "10px 0 14px" }}>
          <span>Showing {filtered.length} of {items.length}{(peopleFilter.length > 1 || tagFilter.length > 1) ? " · items must match every selected person and tag" : ""}</span>
          {filtersActive && <button onClick={clearFilters} style={{ background: "transparent", border: "none", color: STYLES.wax, cursor: "pointer", textDecoration: "underline", fontSize: 12.5 }}>Clear filters</button>}
        </div>

        {items.length === 0 ? (
          <EmptyMsg>Your library is empty. Tap “Add media” to add the first photo, video, or finished post.</EmptyMsg>
        ) : filtered.length === 0 ? (
          <EmptyMsg>Nothing matches those filters.</EmptyMsg>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {filtered.map((i) => <MediaCard key={i.id} item={i} onOpen={setEditing} />)}
          </div>
        )}
      </div>

      {editing && (
        <MediaForm
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          currentUser={currentUser}
          tagSuggestions={allTags}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
