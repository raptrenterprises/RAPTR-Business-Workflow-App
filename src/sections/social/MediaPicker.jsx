import { useState, useMemo } from "react";
import { X, Check, Search, Image as ImageIcon, Video } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { MEDIA_PEOPLE } from "./socialConstants";

function FilterChip({ active, onClick, children, color }) {
  const c = color || STYLES.wax;
  return (
    <button type="button" onClick={onClick} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${active ? c : STYLES.ink + "33"}`, background: active ? c : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  );
}

function Tile({ item, selected, onToggle }) {
  const Icon = item.mediaType === "video" ? Video : ImageIcon;
  return (
    <div onClick={() => onToggle(item.id)} style={{ position: "relative", background: "#fff", border: `2px solid ${selected ? STYLES.green : STYLES.ink + "22"}`, borderRadius: 6, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ aspectRatio: "1 / 1", background: STYLES.gray, display: "flex", alignItems: "center", justifyContent: "center", color: STYLES.slate }}>
        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon size={28} />}
      </div>
      <div style={{ fontSize: 11.5, padding: "4px 6px", wordBreak: "break-word", lineHeight: 1.25 }}>{item.title}</div>
      {item.isAi && <span style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>AI</span>}
      {selected && <div style={{ position: "absolute", top: 5, right: 5, background: STYLES.green, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} /></div>}
    </div>
  );
}

// Search the media library and pick items for a shot. The filters start out set
// to the shot's own requirements (photo/video, people, tags) and can be loosened.
export default function MediaPicker({ media, initialSelected, requirements, shotLabel, title, single, initialKind, allowAi = true, onConfirm, onClose }) {
  const [selected, setSelected] = useState(initialSelected);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(requirements.mediaType || "all");
  const [kindFilter, setKindFilter] = useState(initialKind || "all");
  const [peopleFilter, setPeopleFilter] = useState(requirements.people);
  const [tagFilter, setTagFilter] = useState(requirements.tags);

  const tagList = useMemo(() => {
    const counts = {};
    media.forEach((i) => i.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    requirements.tags.forEach((t) => { counts[t] = counts[t] || 0; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [media, requirements.tags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media.filter((i) => {
      if (selected.includes(i.id)) return true; // already-linked items stay visible so they can be unlinked
      if (!allowAi && i.isAi) return false;
      if (kindFilter !== "all" && i.assetKind !== kindFilter) return false;
      if (typeFilter !== "all" && i.mediaType !== typeFilter) return false;
      if (!peopleFilter.every((p) => i.people.includes(p))) return false;
      if (!tagFilter.every((t) => i.tags.includes(t))) return false;
      if (q && !`${i.title} ${i.fileName} ${i.notes} ${i.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [media, search, typeFilter, kindFilter, peopleFilter, tagFilter, selected, allowAi]);

  const toggleIn = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const toggleSelected = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : single ? [id] : [...s, id]));
  const hasRequirements = requirements.mediaType || requirements.people.length > 0 || requirements.tags.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 110, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "16px 10px" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 760, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17 }}>{title || "Find media for this shot"}</div>
            {shotLabel && <div style={{ fontSize: 13, color: STYLES.slate, marginTop: 2 }}>{shotLabel}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.ink }}><X size={20} /></button>
        </div>

        {!allowAi && <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>AI-generated items are hidden because this post doesn't allow AI images.</div>}
        {hasRequirements && <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>Filters start from what this shot needs. Loosen them to see more.</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <div style={{ position: "relative", flex: "1 1 180px" }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 10, color: STYLES.slate }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, notes, tags" style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 8px 8px 28px" }} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle()}>
            <option value="all">Photos &amp; videos</option>
            <option value="photo">Photos only</option>
            <option value="video">Videos only</option>
          </select>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={selectStyle()}>
            <option value="all">Raw &amp; finished</option>
            <option value="raw">Raw only</option>
            <option value="finished">Finished only</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Who's in it</span>
          {MEDIA_PEOPLE.map((p) => <FilterChip key={p} active={peopleFilter.includes(p)} color={STYLES.blue} onClick={() => toggleIn(peopleFilter, setPeopleFilter, p)}>{p}</FilterChip>)}
        </div>
        {tagList.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Tags</span>
            {tagList.map(([t, n]) => <FilterChip key={t} active={tagFilter.includes(t)} color={STYLES.purple} onClick={() => toggleIn(tagFilter, setTagFilter, t)}>{t} ({n})</FilterChip>)}
          </div>
        )}

        <div style={{ fontSize: 12.5, color: STYLES.slate, margin: "8px 0 10px" }}>Showing {filtered.length} of {media.length}</div>

        {media.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: STYLES.slate, fontSize: 14 }}>The media library is empty. Add media in the Media Library tab first.</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: STYLES.slate, fontSize: 14 }}>Nothing matches. Try removing a filter.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, maxHeight: "48vh", overflowY: "auto", paddingBottom: 4 }}>
            {filtered.map((i) => <Tile key={i.id} item={i} selected={selected.includes(i.id)} onToggle={toggleSelected} />)}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14, padding: "8px 14px" }}>Cancel</button>
          <button type="button" onClick={() => onConfirm(selected)} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {selected.length === 0 ? "Done" : single ? "Use this item" : `Link ${selected.length} ${selected.length === 1 ? "item" : "items"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
