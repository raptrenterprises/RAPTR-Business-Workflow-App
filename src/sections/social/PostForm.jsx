import { useState } from "react";
import { X, Plus, Trash2, ChevronRight, ChevronUp, ChevronDown, Search, ExternalLink } from "lucide-react";
import { STYLES, uid, selectStyle } from "../../constants";
import MediaPicker from "./MediaPicker";
import {
  POST_TYPES, MEDIA_PEOPLE, SHOT_MEDIA_TYPES, PIN_BOARDS, PIN_TOPICS, PIN_TOPICS_MAX, METRICS_BY_TYPE, createsCalendarEvent, STATUS_LABEL, STATUS_COLOR, SEEDER_FIELDS, UNIT_DEFAULT_COUNT, UNIT_NOUN,
  typeConfig, statusFlow, nextStatuses, normalizeStatus, isOnCalendarStatus, normalizeTag,
} from "./socialConstants";

const inputStyle = { ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 };
const textareaStyle = { ...inputStyle, resize: "vertical", fontFamily: "inherit" };
const iconBtn = { background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex", padding: 2 };

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ borderTop: `1px solid ${STYLES.ink}22`, paddingTop: 12, marginTop: 6, marginBottom: 14 }}>
      {title && <div style={{ fontFamily: "Georgia, serif", fontSize: 15, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  );
}

function ToggleChip({ active, onClick, children, small }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: small ? "3px 9px" : "5px 12px", fontSize: small ? 12 : 13, borderRadius: 14, cursor: "pointer", border: `1px solid ${active ? STYLES.blue : STYLES.ink + "33"}`, background: active ? STYLES.blue : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  );
}

// Comma-separated tag entry. Keeps its own text while typing and only
// normalizes into the tag list when you leave the field.
function CommaTagInput({ tags, onChange, placeholder, style, keepCase }) {
  const [text, setText] = useState(tags.join(", "));
  const clean = keepCase ? (t) => t.trim().replace(/\s+/g, " ") : normalizeTag; // Squarespace names and board names keep their capitals
  const commit = () => {
    const next = [...new Set(text.split(",").map(clean).filter(Boolean))];
    onChange(next);
    setText(next.join(", "));
  };
  return <input value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} placeholder={placeholder} style={style || inputStyle} />;
}

// A link field with an "open" button.
function LinkField({ label, value, onChange, placeholder }) {
  const valid = /^https?:\/\//i.test(value);
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} placeholder={placeholder || "Paste the OneDrive link"} inputMode="url" />
        {value && valid && <a href={value} target="_blank" rel="noopener noreferrer" aria-label="Open link" style={{ ...selectStyle(), display: "flex", alignItems: "center", color: STYLES.ink }}><ExternalLink size={16} /></a>}
      </div>
    </Field>
  );
}

function StatusStepper({ postType, status, onChange }) {
  const flow = statusFlow(postType);
  const nexts = nextStatuses(postType, status);
  return (
    <div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {flow.map((s) => {
          const active = s === status;
          const color = STATUS_COLOR[s];
          return (
            <button key={s} type="button" onClick={() => onChange(s)} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${active ? color : STYLES.ink + "33"}`, background: active ? color : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 700 : 400 }}>
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      {nexts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {nexts.map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, color: STATUS_COLOR[n], fontWeight: 600 }}>
              Move to {STATUS_LABEL[n]} <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShotRow({ shot, mediaById, onChange, onRemove, onFind, canRemove }) {
  const togglePerson = (p) => onChange({ people: shot.people.includes(p) ? shot.people.filter((x) => x !== p) : [...shot.people, p] });
  const linked = shot.mediaIds.map((id) => mediaById[id]).filter(Boolean);
  const unlink = (id) => {
    const mediaIds = shot.mediaIds.filter((x) => x !== id);
    onChange({ mediaIds, completed: mediaIds.length > 0 ? shot.completed : false });
  };
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={shot.completed} onChange={(e) => onChange({ completed: e.target.checked })} aria-label="Shot done" style={{ width: 18, height: 18, flexShrink: 0, accentColor: STYLES.green }} />
        <input value={shot.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Describe the shot (e.g. flatlay of the box with hat and letter)" style={{ ...inputStyle, textDecoration: shot.completed ? "line-through" : "none", color: shot.completed ? STYLES.slate : STYLES.ink }} />
        {canRemove && <button type="button" onClick={onRemove} aria-label="Remove shot" style={{ ...iconBtn, flexShrink: 0 }}><Trash2 size={16} /></button>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8, paddingLeft: 26 }}>
        <select value={shot.mediaType} onChange={(e) => onChange({ mediaType: e.target.value })} style={selectStyle()}>
          {SHOT_MEDIA_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {MEDIA_PEOPLE.map((p) => <ToggleChip key={p} small active={shot.people.includes(p)} onClick={() => togglePerson(p)}>{p}</ToggleChip>)}
        <CommaTagInput tags={shot.tags} onChange={(tags) => onChange({ tags })} placeholder="tags, comma separated" style={{ ...selectStyle(), flex: "1 1 140px", minWidth: 120 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8, paddingLeft: 26 }}>
        <button type="button" onClick={onFind} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600 }}><Search size={13} /> {linked.length > 0 ? "Change media" : "Find media"}</button>
        {linked.map((m) => (
          <span key={m.id} title={m.title} style={{ position: "relative", width: 40, height: 40, borderRadius: 4, overflow: "hidden", background: STYLES.gray, border: `1px solid ${STYLES.ink}33`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: STYLES.slate }}>
            {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt={m.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.mediaType === "video" ? "video" : "photo")}
            <button type="button" onClick={() => unlink(m.id)} aria-label={`Unlink ${m.title}`} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.65)", color: "#fff", border: "none", width: 15, height: 15, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

// A list of shot rows with an optional "Add shot" button.
function ShotGroup({ label, shots, multi, mediaById, onPatch, onRemove, onAdd, onFind }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={labelStyle}>{label}</label>}
      {shots.map((s) => <ShotRow key={s.id} shot={s} mediaById={mediaById} canRemove={multi || shots.length > 1} onChange={(patch) => onPatch(s.id, patch)} onRemove={() => onRemove(s)} onFind={() => onFind(s.id)} />)}
      {(multi || shots.length === 0) && <button type="button" onClick={onAdd} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add shot</button>}
    </div>
  );
}

function UnitCard({ index, count, noun, kind, unit, onPatch, onMove, onRemove, children }) {
  return (
    <div style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderLeft: `4px solid ${STYLES.purple}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 15, flex: 1 }}>{noun} {index + 1}</div>
        <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${noun} up`} style={{ ...iconBtn, opacity: index === 0 ? 0.3 : 1 }}><ChevronUp size={18} /></button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${noun} down`} style={{ ...iconBtn, opacity: index === count - 1 ? 0.3 : 1 }}><ChevronDown size={18} /></button>
        <button type="button" onClick={() => onRemove(unit)} aria-label={`Remove ${noun}`} style={iconBtn}><Trash2 size={16} /></button>
      </div>
      {kind === "slide" ? (
        <>
          <Field label="Text overlay"><textarea value={unit.textOverlay} onChange={(e) => onPatch(unit.id, { textOverlay: e.target.value })} rows={2} style={textareaStyle} /></Field>
          {children}
          <LinkField label="Final edited image (link)" value={unit.finalUrl} onChange={(v) => onPatch(unit.id, { finalUrl: v })} />
        </>
      ) : (
        <>
          <Field label="Script"><textarea value={unit.script} onChange={(e) => onPatch(unit.id, { script: e.target.value })} rows={3} style={textareaStyle} placeholder="What's said or narrated in this beat" /></Field>
          <Field label="Editing notes / text overlays"><textarea value={unit.editingNotes} onChange={(e) => onPatch(unit.id, { editingNotes: e.target.value })} rows={3} style={textareaStyle} placeholder="Cuts, transitions, music, on-screen text" /></Field>
          {children}
        </>
      )}
    </div>
  );
}

// Pinterest topics: pick from the list, or type a one-off topic for this pin only. Max 10.
function TopicPicker({ selected, onChange }) {
  const [custom, setCustom] = useState("");
  const full = selected.length >= PIN_TOPICS_MAX;
  const add = (t) => {
    const topic = normalizeTag(t);
    if (!topic || full || selected.includes(topic)) return;
    onChange([...selected, topic]);
  };
  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {selected.map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: STYLES.purple, color: "#fff", borderRadius: 14, padding: "4px 6px 4px 12px", fontSize: 13 }}>
              {t}
              <button type="button" onClick={() => onChange(selected.filter((x) => x !== t))} aria-label={`Remove ${t}`} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", padding: 0 }}><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value="" disabled={full} onChange={(e) => add(e.target.value)} style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }}>
          <option value="">{full ? "Maximum reached" : "Choose a topic…"}</option>
          {PIN_TOPICS.filter((t) => !selected.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={custom} disabled={full} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(custom); setCustom(""); } }} placeholder="Or add a one-off topic" style={{ ...inputStyle, flex: "1 1 160px", width: "auto" }} />
        <button type="button" disabled={full || !custom.trim()} onClick={() => { add(custom); setCustom(""); }} style={{ ...selectStyle(), cursor: "pointer" }}>Add</button>
      </div>
      <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 3 }}>{selected.length}/{PIN_TOPICS_MAX} topics</div>
    </div>
  );
}

function PollFields({ draft, set }) {
  const opts = draft.pollOptions;
  const setOpt = (i, v) => set({ pollOptions: opts.map((o, j) => (j === i ? v : o)) });
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 10, marginBottom: 14 }}>
      <Field label="Poll question"><input value={draft.pollQuestion} onChange={(e) => set({ pollQuestion: e.target.value })} style={inputStyle} placeholder="e.g. Who did it?" /></Field>
      <label style={labelStyle}>Answer choices</label>
      {opts.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={o} onChange={(e) => setOpt(i, e.target.value)} style={inputStyle} placeholder={`Choice ${i + 1}`} />
          <button type="button" onClick={() => set({ pollOptions: opts.filter((_, j) => j !== i) })} aria-label={`Remove choice ${i + 1}`} style={iconBtn}><Trash2 size={16} /></button>
        </div>
      ))}
      <button type="button" onClick={() => set({ pollOptions: [...opts, ""] })} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add choice</button>
    </div>
  );
}

function PollToggle({ draft, set }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: STYLES.ink, cursor: "pointer" }}>
      <input type="checkbox" checked={draft.pollEnabled} onChange={(e) => set({ pollEnabled: e.target.checked, pollOptions: e.target.checked && draft.pollOptions.length === 0 ? ["", ""] : draft.pollOptions })} style={{ width: 16, height: 16, accentColor: STYLES.wax }} /> Poll
    </label>
  );
}

// Performance metrics: shown once a post is Live. Values are typed in by hand for now.
function MetricsSection({ draft, set, keywords, onKeywordsChange }) {
  const cfg = METRICS_BY_TYPE[draft.postType];
  if (!cfg) return null;
  const setMetric = (key, value) => {
    const next = { ...draft.metrics };
    if (value === "") delete next[key];
    else next[key] = Number(value);
    set({ metrics: next });
  };
  const patchKw = (id, patch) => onKeywordsChange(keywords.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  const kwInput = { ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 13, padding: "6px 8px" };
  return (
    <Section title="Performance metrics">
      <Field label="Numbers as of">
        <input type="date" value={draft.metricsUpdatedOn} onChange={(e) => set({ metricsUpdatedOn: e.target.value })} style={{ ...inputStyle, maxWidth: 200 }} />
      </Field>
      {cfg.groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: STYLES.slate, marginBottom: 6 }}>{g.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
            {g.fields.map((f) => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" step="any" value={draft.metrics[f.key] ?? ""} onChange={(e) => setMetric(f.key, e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {draft.pollEnabled && draft.postType !== "Blog post" && draft.postType !== "Pinterest pin" && (
        <Field label="Poll results"><textarea value={draft.metrics.poll_results || ""} onChange={(e) => set({ metrics: { ...draft.metrics, poll_results: e.target.value } })} rows={2} style={textareaStyle} placeholder="e.g. Yes 62%, No 38%" /></Field>
      )}
      {cfg.keywords && (
        <div>
          <label style={labelStyle}>Google Search Console keywords (last 30 days)</label>
          {keywords.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 2fr) repeat(4, minmax(60px, 1fr)) 24px", gap: 6, fontSize: 11.5, color: STYLES.slate, marginBottom: 4 }}>
              <span>Keyword</span><span>Impressions</span><span>Clicks</span><span>Click rate %</span><span>Avg position</span><span />
            </div>
          )}
          {keywords.map((k) => {
            const auto = k.ctr === "" && Number(k.impressions) > 0 && k.clicks !== "" ? String(Math.round((Number(k.clicks) / Number(k.impressions)) * 10000) / 100) : "";
            return (
              <div key={k.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 2fr) repeat(4, minmax(60px, 1fr)) 24px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <input value={k.keyword} onChange={(e) => patchKw(k.id, { keyword: e.target.value })} placeholder="keyword" style={kwInput} />
                <input type="number" min="0" value={k.impressions} onChange={(e) => patchKw(k.id, { impressions: e.target.value })} style={kwInput} />
                <input type="number" min="0" value={k.clicks} onChange={(e) => patchKw(k.id, { clicks: e.target.value })} style={kwInput} />
                <input type="number" step="any" value={k.ctr} onChange={(e) => patchKw(k.id, { ctr: e.target.value })} placeholder={auto} style={kwInput} />
                <input type="number" step="any" value={k.avgPosition} onChange={(e) => patchKw(k.id, { avgPosition: e.target.value })} style={kwInput} />
                <button type="button" onClick={() => onKeywordsChange(keywords.filter((x) => x.id !== k.id), k.id)} aria-label="Remove keyword" style={iconBtn}><Trash2 size={15} /></button>
              </div>
            );
          })}
          <button type="button" onClick={() => onKeywordsChange([...keywords, { id: uid(), keyword: "", impressions: "", clicks: "", ctr: "", avgPosition: "" }])} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add keyword</button>
          <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 4 }}>Leave click rate blank to have it worked out from clicks and impressions.</div>
        </div>
      )}
    </Section>
  );
}

const blankUnit = () => ({ id: uid(), textOverlay: "", script: "", editingNotes: "", finalUrl: "" });
const blankShot = (postId, unitId) => ({ id: uid(), postId, unitId: unitId || null, description: "", mediaType: "", people: [], tags: [], completed: false, mediaIds: [] });
const blankPost = (campaignId) => ({
  id: uid(), title: "", postType: "Reel", status: "idea", publishDate: "", publishTime: "", description: "", caption: "", seederComments: "",
  seederRaptr: "", seederEvan: "", seederEvanReply: "", seederCathy: "", seederCathyReply: "", textOverlay: "", finalUrl: "",
  blogText: "", sqsCategories: [], sqsTags: [], crossLinks: "", pinCategories: [], pinBoardPrimary: "", pinBoardsSecondary: [], pinDescription: "", pinTitle: "", pinLink: "", pinTopics: [], pinAltText: "",
  musicAudio: "", pollEnabled: false, pollQuestion: "", pollOptions: [], metrics: {}, metricsUpdatedOn: "", attachments: [],
  notes: "", tags: [], campaignId: campaignId || "",
});

// Makes sure a post of this type has the structure it needs: slides/beats each with a
// shot row, or the right number of shot rows on the post itself.
function ensureStructure(postType, units, shots, postId) {
  const cfg = typeConfig(postType);
  let u = units;
  let s = shots;
  if (cfg.units) {
    if (u.length === 0) u = Array.from({ length: UNIT_DEFAULT_COUNT[cfg.units] }, blankUnit);
    const missing = u.filter((unit) => !s.some((x) => x.unitId === unit.id)).map((unit) => blankShot(postId, unit.id));
    s = [...s, ...missing];
  } else if (cfg.shots && s.length === 0) {
    s = [blankShot(postId, null)];
  }
  return { units: u, shots: s };
}

const unitHasContent = (unit, shotList) =>
  [unit.textOverlay, unit.script, unit.editingNotes, unit.finalUrl].some((v) => v.trim()) || shotList.some((s) => s.unitId === unit.id && s.description.trim());
const badUrl = (v) => v.trim() && !/^https?:\/\//i.test(v.trim());

export default function PostForm({ post, defaults, notice, shots, units: savedUnits, keywords: savedKeywords, shotMedia, media, campaigns, currentUser, onSave, onDelete, onClose }) {
  const isNew = !post;
  const [originalLinks] = useState(() => {
    const m = {};
    shotMedia.forEach((l) => { (m[l.shotItemId] = m[l.shotItemId] || []).push(l.mediaId); });
    return m;
  });
  const [draft, setDraft] = useState(() => (post ? { ...post, attachments: post.attachments.map((a) => ({ ...a })) } : blankPost(defaults?.campaignId)));
  const [structure, setStructure] = useState(() => {
    const u = savedUnits.map((x) => ({ ...x }));
    const s = shots.map((x) => ({ ...x, mediaIds: originalLinks[x.id] || [] }));
    return ensureStructure(post ? post.postType : "Reel", u, s, post ? post.id : "");
  });
  const [keywords, setKeywords] = useState(() => savedKeywords.map((k) => ({ ...k })));
  const [removedKeywordIds, setRemovedKeywordIds] = useState([]);
  const origKeywordIds = new Set(savedKeywords.map((k) => k.id));
  const [removedUnitIds, setRemovedUnitIds] = useState([]);
  const [removedShotIds, setRemovedShotIds] = useState([]);
  const [pickerShotId, setPickerShotId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice || "");
  const { units, shots: shotList } = structure;
  const cfg = typeConfig(draft.postType);
  const mediaById = Object.fromEntries(media.map((m) => [m.id, m]));
  const origShotIds = new Set(shots.map((s) => s.id));
  const origUnitIds = new Set(savedUnits.map((u) => u.id));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setUnits = (fn) => setStructure((st) => ({ ...st, units: fn(st.units) }));
  const setShots = (fn) => setStructure((st) => ({ ...st, shots: fn(st.shots) }));

  // The shot rows a post or unit needs: new posts get their blank rows with the post's own id.
  const fixPostId = (list) => list.map((s) => ({ ...s, postId: draft.id }));
  function changeType(postType) {
    setDraft((d) => ({ ...d, postType, status: normalizeStatus(postType, d.status) }));
    setStructure((st) => {
      const next = ensureStructure(postType, st.units, st.shots, draft.id);
      return { units: next.units, shots: fixPostId(next.shots) };
    });
  }

  const patchShot = (id, patch) => setShots((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addShot = (unitId) => setShots((list) => [...list, blankShot(draft.id, unitId)]);
  const dropShotFromList = (shot) => {
    setShots((list) => list.filter((s) => s.id !== shot.id));
    if (origShotIds.has(shot.id)) setRemovedShotIds((ids) => [...ids, shot.id]);
  };
  const patchUnit = (id, patch) => setUnits((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const addUnit = () => {
    const unit = blankUnit();
    setStructure((st) => ({ units: [...st.units, unit], shots: [...st.shots, blankShot(draft.id, unit.id)] }));
  };
  const moveUnit = (index, dir) => setUnits((list) => {
    const next = list.slice();
    const j = index + dir;
    if (j < 0 || j >= next.length) return list;
    [next[index], next[j]] = [next[j], next[index]];
    return next;
  });
  const removeUnit = (unit) => {
    const noun = UNIT_NOUN[cfg.units].toLowerCase();
    if (unitHasContent(unit, shotList) && !window.confirm(`Remove this ${noun} and everything in it?`)) return;
    const theirShots = shotList.filter((s) => s.unitId === unit.id);
    setStructure((st) => ({ units: st.units.filter((u) => u.id !== unit.id), shots: st.shots.filter((s) => s.unitId !== unit.id) }));
    setRemovedShotIds((ids) => [...ids, ...theirShots.filter((s) => origShotIds.has(s.id)).map((s) => s.id)]);
    if (origUnitIds.has(unit.id)) setRemovedUnitIds((ids) => [...ids, unit.id]);
  };

  async function submit(e) {
    e.preventDefault();
    if (!draft.title.trim()) { setError("Give this post a title."); return; }
    if (draft.publishTime && !draft.publishDate) { setError("Add a publish date to go with the time."); return; }
    if (isOnCalendarStatus(draft.status) && (!draft.publishDate || !draft.publishTime)) { setError("Add a publish date and time first. The post goes on the calendar at that time."); return; }
    if ([draft.finalUrl, draft.pinLink, ...units.map((u) => u.finalUrl), ...draft.attachments.map((a) => a.url)].some(badUrl)) { setError("Links should start with https://"); return; }
    setBusy(true);
    setError("");
    try {
      // Slides/beats only belong to Carousel/Reel. Keep ones that were already saved; drop new blanks.
      const keepUnits = cfg.units ? units : units.filter((u) => origUnitIds.has(u.id));
      const keepUnitIds = new Set(keepUnits.map((u) => u.id));
      const inScope = shotList.filter((s) => !s.unitId || keepUnitIds.has(s.unitId));
      const cleanShots = inScope.filter((s) => s.description.trim());
      const dropped = shotList.filter((s) => !cleanShots.includes(s) && origShotIds.has(s.id)).map((s) => s.id);
      const removed = { unitIds: removedUnitIds, shotIds: [...new Set([...removedShotIds, ...dropped])] };
      const keepKeywords = keywords.filter((k) => k.keyword.trim());
      const goneKeywords = [...removedKeywordIds, ...keywords.filter((k) => !k.keyword.trim() && origKeywordIds.has(k.id)).map((k) => k.id)];
      await onSave({ ...draft, title: draft.title.trim(), createdBy: currentUser, createdAt: new Date().toISOString() }, keepUnits, cleanShots, removed, isNew, originalLinks, { keywords: keepKeywords, removedKeywordIds: goneKeywords });
    } catch (err) {
      setError("Couldn't save: " + err.message);
      setBusy(false);
    }
  }

  // Fields a type doesn't use stay hidden, unless they already hold something (so nothing is ever invisible).
  const hasSeeders = SEEDER_FIELDS.some((f) => draft[f.key]);
  const showCaption = cfg.caption || draft.caption;
  const showSeeders = cfg.seeders || hasSeeders;
  const showOverlay = cfg.overlay || draft.textOverlay;
  const shotsForPost = cfg.units ? shotList.filter((s) => !s.unitId || !units.some((u) => u.id === s.unitId)) : shotList;
  const doneCount = shotList.filter((s) => s.completed).length;
  const unitNoun = cfg.units ? UNIT_NOUN[cfg.units] : "";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 680, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{isNew ? "New post" : "Edit post"}</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.ink }}><X size={20} /></button>
        </div>

        <Field label="Title">
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} style={inputStyle} placeholder="e.g. October Side Quests carousel" />
        </Field>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <Field label="Post type">
              <select value={draft.postType} onChange={(e) => changeType(e.target.value)} style={inputStyle}>
                {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <Field label="Campaign">
              <select value={draft.campaignId} onChange={(e) => set({ campaignId: e.target.value })} style={inputStyle}>
                <option value="">None</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <Field label="Status">
          <StatusStepper postType={draft.postType} status={draft.status} onChange={(status) => set({ status })} />
          {draft.status === "scheduled" && <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 8 }}>{createsCalendarEvent(draft.postType) ? "Saving adds this post to the calendar at its publish time, with the seeder comments in the event description. " : "This type doesn't go on the calendar. "}It moves to Live automatically once its publish time passes.</div>}
          {draft.status === "ready_to_post" && <div style={{ fontSize: 11.5, color: STATUS_COLOR.ready_to_post, marginTop: 8 }}>For posts that can't be pre-scheduled. Saving {createsCalendarEvent(draft.postType) ? "adds it to the calendar and " : ""}creates a task for Cathy to post it, due on the publish date. It stays here until you move it to Live after posting.</div>}
          {draft.calendarEventId && (isOnCalendarStatus(draft.status) || draft.status === "live") && <div style={{ fontSize: 11.5, color: STYLES.green, marginTop: 4 }}>On the calendar. Changes to the title, date, time, or seeder comments update the event. Moving the post out of Scheduled, Ready to manually post, or Live removes it.</div>}
        </Field>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <Field label="Publish date">
              <input type="date" value={draft.publishDate} onChange={(e) => set({ publishDate: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <Field label="Publish time">
              <input type="time" value={draft.publishTime} onChange={(e) => set({ publishTime: e.target.value })} style={inputStyle} />
            </Field>
          </div>
        </div>

        <Field label="Idea overview">
          <textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={3} style={textareaStyle} placeholder="What is this post, and why?" />
        </Field>

        {cfg.music && <Field label="Music / audio"><input value={draft.musicAudio} onChange={(e) => set({ musicAudio: e.target.value })} style={inputStyle} placeholder="Track name, artist, or link" /></Field>}

        {/* ---- Carousel slides / reel beats ---- */}
        {cfg.units && (
          <Section title={`${unitNoun}s (${units.length})`}>
            {units.map((unit, i) => {
              const unitShots = shotList.filter((s) => s.unitId === unit.id);
              return (
                <UnitCard key={unit.id} index={i} count={units.length} noun={unitNoun} kind={cfg.units} unit={unit} onPatch={patchUnit} onMove={moveUnit} onRemove={removeUnit}>
                  <ShotGroup label={cfg.units === "slide" ? "Shot list item" : "Shot list items"} shots={unitShots} multi={cfg.units === "beat"} mediaById={mediaById} onPatch={patchShot} onRemove={dropShotFromList} onAdd={() => addShot(unit.id)} onFind={setPickerShotId} />
                </UnitCard>
              );
            })}
            <button type="button" onClick={addUnit} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add {unitNoun.toLowerCase()}</button>
            {shotsForPost.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <ShotGroup label="Other shots on this post" shots={shotsForPost} multi mediaById={mediaById} onPatch={patchShot} onRemove={dropShotFromList} onAdd={() => addShot(null)} onFind={setPickerShotId} />
              </div>
            )}
          </Section>
        )}

        {/* ---- Single-unit types: text, shots, links ---- */}
        {!cfg.units && (
          <Section title={cfg.blog ? "Blog post" : cfg.pin ? "Pin" : "Content"}>
            {cfg.blog && (
              <>
                <Field label="Blog post text"><textarea value={draft.blogText} onChange={(e) => set({ blogText: e.target.value })} rows={10} style={textareaStyle} /></Field>
                <Field label="Squarespace categories" hint="Comma separated. Capitals are kept as typed."><CommaTagInput keepCase tags={draft.sqsCategories} onChange={(sqsCategories) => set({ sqsCategories })} placeholder="e.g. Party Planning, Mystery Tips" /></Field>
                <Field label="Squarespace tags" hint="Comma separated. These are separate from the internal tags below."><CommaTagInput keepCase tags={draft.sqsTags} onChange={(sqsTags) => set({ sqsTags })} placeholder="e.g. murder mystery, hosting" /></Field>
              </>
            )}
            {showOverlay && <Field label="Text overlay"><textarea value={draft.textOverlay} onChange={(e) => set({ textOverlay: e.target.value })} rows={2} style={textareaStyle} /></Field>}
            {cfg.poll && !cfg.caption && (
              <div style={{ marginBottom: 14 }}>
                <PollToggle draft={draft} set={set} />
                {draft.pollEnabled && <div style={{ marginTop: 8 }}><PollFields draft={draft} set={set} /></div>}
              </div>
            )}
            {cfg.pin && (
              <>
                <Field label="Pin title"><input value={draft.pinTitle} onChange={(e) => set({ pinTitle: e.target.value })} style={inputStyle} /></Field>
                <Field label="Pin description"><textarea value={draft.pinDescription} onChange={(e) => set({ pinDescription: e.target.value })} rows={3} style={textareaStyle} /></Field>
                <Field label="Link (where the pin takes a viewer)" hint="Separate from the image file link below.">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={draft.pinLink} onChange={(e) => set({ pinLink: e.target.value })} style={inputStyle} placeholder="https://raptrmysteries.com/…" inputMode="url" />
                    {draft.pinLink && /^https?:\/\//i.test(draft.pinLink) && <a href={draft.pinLink} target="_blank" rel="noopener noreferrer" aria-label="Open link" style={{ ...selectStyle(), display: "flex", alignItems: "center", color: STYLES.ink }}><ExternalLink size={16} /></a>}
                  </div>
                </Field>
                <Field label="Alt text"><textarea value={draft.pinAltText} onChange={(e) => set({ pinAltText: e.target.value })} rows={2} style={textareaStyle} placeholder="Describe the image for people who can't see it" /></Field>
                <Field label="Topics" hint="Up to 10 per pin."><TopicPicker selected={draft.pinTopics} onChange={(pinTopics) => set({ pinTopics })} /></Field>
                <Field label="Primary board">
                  <select value={draft.pinBoardPrimary} onChange={(e) => set({ pinBoardPrimary: e.target.value, pinBoardsSecondary: draft.pinBoardsSecondary.filter((b) => b !== e.target.value) })} style={inputStyle}>
                    <option value="">Choose a board…</option>
                    {PIN_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Secondary boards (optional)">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PIN_BOARDS.filter((b) => b !== draft.pinBoardPrimary).map((b) => (
                      <ToggleChip key={b} small active={draft.pinBoardsSecondary.includes(b)} onClick={() => set({ pinBoardsSecondary: draft.pinBoardsSecondary.includes(b) ? draft.pinBoardsSecondary.filter((x) => x !== b) : [...draft.pinBoardsSecondary, b] })}>{b}</ToggleChip>
                    ))}
                  </div>
                </Field>
                <Field label="Categories / tags" hint="Comma separated"><CommaTagInput tags={draft.pinCategories} onChange={(pinCategories) => set({ pinCategories })} placeholder="e.g. party ideas, murder mystery" /></Field>
              </>
            )}
            <ShotGroup label={cfg.shotLabel} shots={shotList} multi={cfg.shots === "multi"} mediaById={mediaById} onPatch={patchShot} onRemove={dropShotFromList} onAdd={() => addShot(null)} onFind={setPickerShotId} />
            {cfg.finalLabel && <LinkField label={cfg.finalLabel} value={draft.finalUrl} onChange={(v) => set({ finalUrl: v })} />}
            {cfg.blog && <Field label="Cross-reference links to add after publishing" hint="Posts or pages to link to once this is live"><textarea value={draft.crossLinks} onChange={(e) => set({ crossLinks: e.target.value })} rows={3} style={textareaStyle} /></Field>}
            {cfg.attachments && (
              <Field label="Attachments (links)">
                {draft.attachments.map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={a.label} onChange={(e) => set({ attachments: draft.attachments.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)) })} placeholder="Label" style={{ ...inputStyle, flex: "1 1 120px" }} />
                    <input value={a.url} onChange={(e) => set({ attachments: draft.attachments.map((x) => (x.id === a.id ? { ...x, url: e.target.value } : x)) })} placeholder="https://…" inputMode="url" style={{ ...inputStyle, flex: "2 1 180px" }} />
                    <button type="button" onClick={() => set({ attachments: draft.attachments.filter((x) => x.id !== a.id) })} aria-label="Remove attachment" style={iconBtn}><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => set({ attachments: [...draft.attachments, { id: uid(), label: "", url: "" }] })} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add attachment</button>
              </Field>
            )}
          </Section>
        )}

        {/* ---- Reel: one final video per reel ---- */}
        {cfg.units && cfg.finalLabel && <LinkField label={cfg.finalLabel} value={draft.finalUrl} onChange={(v) => set({ finalUrl: v })} />}

        {(showCaption || showSeeders) && (
          <Section title="Caption & seeder comments">
            {showCaption && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Caption</label>
                  {cfg.poll && <PollToggle draft={draft} set={set} />}
                </div>
                <textarea value={draft.caption} onChange={(e) => set({ caption: e.target.value })} rows={5} style={textareaStyle} placeholder="The caption as it will be posted, hashtags included" />
                {cfg.poll && draft.pollEnabled && <div style={{ marginTop: 10 }}><PollFields draft={draft} set={set} /></div>}
              </div>
            )}
            {showSeeders && SEEDER_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}><textarea value={draft[f.key]} onChange={(e) => set({ [f.key]: e.target.value })} rows={2} style={textareaStyle} /></Field>
            ))}
            {draft.seederComments && (
              <Field label="Other seeder notes (imported from the calendar)" hint="Kept as-is and appended to the calendar event description."><textarea value={draft.seederComments} onChange={(e) => set({ seederComments: e.target.value })} rows={4} style={textareaStyle} /></Field>
            )}
          </Section>
        )}

        {shotList.length > 0 && <div style={{ fontSize: 11.5, color: STYLES.slate, marginBottom: 10 }}>{doneCount}/{shotList.filter((s) => s.description.trim()).length} shots done{draft.postType !== "Blog post" ? ". When every shot is checked off, a Planned post moves to Filmed automatically." : "."}</div>}

        <Field label="Tags (internal)" hint="Comma separated, e.g. summerville ranch, giveaway">
          <CommaTagInput tags={draft.tags} onChange={(tags) => set({ tags })} placeholder="tags, comma separated" />
        </Field>

        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} style={textareaStyle} placeholder="Ideas, references, links, reminders…" />
        </Field>

        {draft.status === "live" && (
          <MetricsSection draft={draft} set={set} keywords={keywords} onKeywordsChange={(next, removedId) => { setKeywords(next); if (removedId && origKeywordIds.has(removedId)) setRemovedKeywordIds((ids) => [...ids, removedId]); }} />
        )}

        {error && <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: "8px 10px", borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          {!isNew ? (
            <button type="button" disabled={busy} onClick={() => onDelete(post)} style={{ ...selectStyle(), cursor: "pointer", color: STYLES.wax, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={14} /> Delete</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14, padding: "8px 14px" }}>Cancel</button>
            <button type="submit" disabled={busy} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : isNew ? "Create post" : "Save changes"}</button>
          </div>
        </div>
      </form>

      {pickerShotId && (() => {
        const shot = shotList.find((x) => x.id === pickerShotId);
        if (!shot) return null;
        return (
          <MediaPicker
            media={media}
            initialSelected={shot.mediaIds}
            requirements={{ mediaType: shot.mediaType, people: shot.people, tags: shot.tags }}
            shotLabel={shot.description}
            onClose={() => setPickerShotId(null)}
            onConfirm={(ids) => {
              const hadLinks = shot.mediaIds.length > 0;
              patchShot(shot.id, { mediaIds: ids, completed: ids.length > 0 ? true : hadLinks ? false : shot.completed });
              setPickerShotId(null);
            }}
          />
        );
      })()}
    </div>
  );
}
