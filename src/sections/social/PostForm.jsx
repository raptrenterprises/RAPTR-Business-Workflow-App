import { useState } from "react";
import { X, Plus, Trash2, ChevronRight, Search } from "lucide-react";
import { STYLES, uid, selectStyle } from "../../constants";
import MediaPicker from "./MediaPicker";
import { POST_TYPES, MEDIA_PEOPLE, SHOT_MEDIA_TYPES, STATUS_LABEL, STATUS_COLOR, statusFlow, nextStatus, normalizeStatus, normalizeTag } from "./socialConstants";

const inputStyle = { ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 };
const textareaStyle = { ...inputStyle, resize: "vertical", fontFamily: "inherit" };

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 3 }}>{hint}</div>}
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
function CommaTagInput({ tags, onChange, placeholder, style }) {
  const [text, setText] = useState(tags.join(", "));
  const commit = () => {
    const next = [...new Set(text.split(",").map(normalizeTag).filter(Boolean))];
    onChange(next);
    setText(next.join(", "));
  };
  return <input value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} placeholder={placeholder} style={style || inputStyle} />;
}

function StatusStepper({ postType, status, onChange }) {
  const flow = statusFlow(postType);
  const next = nextStatus(postType, status);
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
      {next && (
        <button type="button" onClick={() => onChange(next)} style={{ marginTop: 8, ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, color: STATUS_COLOR[next], fontWeight: 600 }}>
          Move to {STATUS_LABEL[next]} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function ShotRow({ shot, mediaById, onChange, onRemove, onFind }) {
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
        <button type="button" onClick={onRemove} aria-label="Remove shot" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex", flexShrink: 0 }}><Trash2 size={16} /></button>
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

const blankPost = (campaignId) => ({
  id: uid(), title: "", postType: "Reel", status: "idea", publishDate: "", publishTime: "", caption: "",
  seederComments: "", textOverlay: "", notes: "", tags: [], campaignId: campaignId || "",
});

export default function PostForm({ post, defaults, notice, shots, shotMedia, media, campaigns, currentUser, onSave, onDelete, onClose }) {
  const isNew = !post;
  const [draft, setDraft] = useState(post ? { ...post } : blankPost(defaults?.campaignId));
  const [originalLinks] = useState(() => {
    const m = {};
    shotMedia.forEach((l) => { (m[l.shotItemId] = m[l.shotItemId] || []).push(l.mediaId); });
    return m;
  });
  const [shotList, setShotList] = useState(() => shots.map((s) => ({ ...s, mediaIds: originalLinks[s.id] || [] })));
  const [pickerShotId, setPickerShotId] = useState(null);
  const mediaById = Object.fromEntries(media.map((m) => [m.id, m]));
  const [removedIds, setRemovedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice || "");

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setType = (postType) => setDraft((d) => ({ ...d, postType, status: normalizeStatus(postType, d.status) }));
  const patchShot = (id, patch) => setShotList((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addShot = () => setShotList((list) => [...list, { id: uid(), postId: draft.id, description: "", mediaType: "", people: [], tags: [], completed: false, mediaIds: [] }]);
  const removeShot = (shot) => {
    setShotList((list) => list.filter((s) => s.id !== shot.id));
    if (shots.some((s) => s.id === shot.id)) setRemovedIds((ids) => [...ids, shot.id]);
  };

  async function submit(e) {
    e.preventDefault();
    if (!draft.title.trim()) { setError("Give this post a title."); return; }
    if (draft.publishTime && !draft.publishDate) { setError("Add a publish date to go with the time."); return; }
    if (draft.status === "scheduled" && (!draft.publishDate || !draft.publishTime)) { setError("Add a publish date and time before scheduling — the post goes on the calendar at that time."); return; }
    setBusy(true);
    setError("");
    try {
      const cleanShots = shotList.filter((s) => s.description.trim());
      const dropped = shotList.filter((s) => !s.description.trim() && shots.some((o) => o.id === s.id)).map((s) => s.id);
      await onSave({ ...draft, title: draft.title.trim(), createdBy: currentUser, createdAt: new Date().toISOString() }, cleanShots, [...removedIds, ...dropped], isNew, originalLinks);
    } catch (err) {
      setError("Couldn't save: " + err.message);
      setBusy(false);
    }
  }

  const doneCount = shotList.filter((s) => s.completed).length;
  const autoFilms = draft.postType !== "Blog post";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 640, padding: 20 }}>
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
              <select value={draft.postType} onChange={(e) => setType(e.target.value)} style={inputStyle}>
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
          {draft.status === "scheduled" && <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 8 }}>Saving adds this post to the calendar at its publish time, with the seeder comments in the event description.</div>}
          {draft.calendarEventId && (draft.status === "scheduled" || draft.status === "live") && <div style={{ fontSize: 11.5, color: STYLES.green, marginTop: 4 }}>On the calendar. Changes to the title, date, time, or seeder comments update the event. Moving the post out of Scheduled/Live removes it.</div>}
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

        <Field label="Caption">
          <textarea value={draft.caption} onChange={(e) => set({ caption: e.target.value })} rows={5} style={textareaStyle} placeholder="The caption as it will be posted, hashtags included" />
        </Field>

        <Field label="Seeder comments" hint="One per line, in the order they'll be posted.">
          <textarea value={draft.seederComments} onChange={(e) => set({ seederComments: e.target.value })} rows={5} style={textareaStyle} placeholder={"RAPTR (initial comment): …\nCathy (personal): …"} />
        </Field>

        <Field label="Text overlay" hint="On-screen text, slide by slide or in order of appearance.">
          <textarea value={draft.textOverlay} onChange={(e) => set({ textOverlay: e.target.value })} rows={3} style={textareaStyle} />
        </Field>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Shot list {shotList.length > 0 && `(${doneCount}/${shotList.length} done)`}</label>
          </div>
          {shotList.map((s) => (
            <ShotRow key={s.id} shot={s} mediaById={mediaById} onChange={(patch) => patchShot(s.id, patch)} onRemove={() => removeShot(s)} onFind={() => setPickerShotId(s.id)} />
          ))}
          <button type="button" onClick={addShot} style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add shot</button>
          {autoFilms && <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 6 }}>When every shot is checked off, a Planned post moves to Filmed automatically.</div>}
        </div>

        <Field label="Tags" hint="Comma separated, e.g. summerville ranch, giveaway">
          <CommaTagInput tags={draft.tags} onChange={(tags) => set({ tags })} placeholder="tags, comma separated" />
        </Field>

        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} style={textareaStyle} placeholder="Ideas, references, links, reminders…" />
        </Field>

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
