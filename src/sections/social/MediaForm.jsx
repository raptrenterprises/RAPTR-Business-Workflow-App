import { useState, useEffect } from "react";
import { X, ImagePlus, Trash2, ExternalLink } from "lucide-react";
import { STYLES, uid, selectStyle } from "../../constants";
import { uploadAttachment, deleteAttachment } from "../../lib/storageApi";
import { makeThumbnail, isVideoFile } from "../../lib/thumbnails";
import { MEDIA_TYPES, ASSET_KINDS, POST_FORMATS, MEDIA_PEOPLE, normalizeTag } from "./socialConstants";

const inputStyle = { ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ToggleChip({ active, onClick, children, color }) {
  const c = color || STYLES.wax;
  return (
    <button type="button" onClick={onClick} style={{ padding: "5px 12px", fontSize: 13, borderRadius: 14, cursor: "pointer", border: `1px solid ${active ? c : STYLES.ink + "33"}`, background: active ? c : "#fff", color: active ? "#fff" : STYLES.ink, fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  );
}

const blankDraft = () => ({
  id: uid(), title: "", mediaType: "photo", assetKind: "raw", isAi: false, postFormat: "", sourceUrl: "", fileName: "",
  onedriveItemId: "", thumbnailUrl: "", thumbnailPath: "", people: [], tags: [], shotDate: "", notes: "",
});

export default function MediaForm({ item, currentUser, tagSuggestions, onSave, onDelete, onClose }) {
  const isNew = !item;
  const [draft, setDraft] = useState(item ? { ...item } : blankDraft());
  const [tagInput, setTagInput] = useState("");
  const [pendingThumb, setPendingThumb] = useState(null); // { blob, previewUrl }
  const [thumbRemoved, setThumbRemoved] = useState(false);
  const [thumbNote, setThumbNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Free the temporary preview URL when it changes or the form closes.
  useEffect(() => () => { if (pendingThumb) URL.revokeObjectURL(pendingThumb.previewUrl); }, [pendingThumb]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleIn = (key, value) => set({ [key]: draft[key].includes(value) ? draft[key].filter((v) => v !== value) : [...draft[key], value] });

  const addTag = (raw) => {
    const t = normalizeTag(raw);
    if (!t || draft.tags.includes(t)) { setTagInput(""); return; }
    set({ tags: [...draft.tags, t] });
    setTagInput("");
  };

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setThumbNote("");
    const patch = { fileName: file.name, mediaType: isVideoFile(file) ? "video" : "photo" };
    if (!draft.title.trim()) patch.title = file.name.replace(/\.[^.]+$/, "");
    set(patch);
    try {
      const blob = await makeThumbnail(file);
      setPendingThumb({ blob, previewUrl: URL.createObjectURL(blob), name: file.name.replace(/\.[^.]+$/, "") + ".jpg" });
      setThumbRemoved(false);
    } catch (err) {
      setPendingThumb(null);
      setThumbNote(err.message + " You can still save this item without a thumbnail.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!draft.title.trim()) { setError("Give this item a title."); return; }
    if (draft.sourceUrl.trim() && !/^https?:\/\//i.test(draft.sourceUrl.trim())) { setError("The OneDrive link should start with https://"); return; }
    setBusy(true);
    setError("");
    try {
      const out = { ...draft, title: draft.title.trim(), sourceUrl: draft.sourceUrl.trim() };
      const oldPath = item?.thumbnailPath || "";
      if (pendingThumb) {
        const file = new File([pendingThumb.blob], pendingThumb.name, { type: "image/jpeg" });
        const up = await uploadAttachment(file, "media/thumbs", currentUser);
        out.thumbnailUrl = up.url;
        out.thumbnailPath = up.path;
      } else if (thumbRemoved) {
        out.thumbnailUrl = "";
        out.thumbnailPath = "";
      }
      if (oldPath && oldPath !== out.thumbnailPath) { try { await deleteAttachment(oldPath); } catch (_) { /* already gone */ } }
      await onSave(out, isNew);
    } catch (err) {
      setError("Couldn't save: " + err.message);
      setBusy(false);
    }
  }

  const previewSrc = pendingThumb ? pendingThumb.previewUrl : thumbRemoved ? "" : draft.thumbnailUrl;
  const unusedSuggestions = tagSuggestions.filter((t) => !draft.tags.includes(t)).slice(0, 12);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 560, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{isNew ? "Add media" : "Edit media"}</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.ink }}><X size={20} /></button>
        </div>

        <Field label="Thumbnail">
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 96, height: 96, background: "#fff", border: `1px solid ${STYLES.ink}33`, borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: STYLES.slate, fontSize: 11 }}>
              {previewSrc ? <img src={previewSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "No thumbnail"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: STYLES.wax, color: STYLES.parchment, border: "none" }}>
                <ImagePlus size={14} /> Choose photo or video
                <input type="file" accept="image/*,video/*" onChange={onPickFile} style={{ display: "none" }} />
              </label>
              {previewSrc && <button type="button" onClick={() => { setPendingThumb(null); setThumbRemoved(true); }} style={{ ...selectStyle(), cursor: "pointer", color: STYLES.slate }}>Remove thumbnail</button>}
            </div>
          </div>
          <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 6 }}>The file is only used to make a small preview. It isn't uploaded — the original stays in OneDrive.</div>
          {thumbNote && <div style={{ fontSize: 12, color: STYLES.wax, marginTop: 4 }}>{thumbNote}</div>}
        </Field>

        <Field label="Title">
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} style={inputStyle} placeholder="e.g. Summerville Ranch flatlay – hat and letter" />
        </Field>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <Field label="Type">
              <select value={draft.mediaType} onChange={(e) => set({ mediaType: e.target.value })} style={inputStyle}>
                {MEDIA_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <Field label="Kind">
              <select value={draft.assetKind} onChange={(e) => set({ assetKind: e.target.value })} style={inputStyle}>
                {ASSET_KINDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          {draft.assetKind === "finished" && (
            <div style={{ flex: "1 1 160px" }}>
              <Field label="Post format">
                <select value={draft.postFormat} onChange={(e) => set({ postFormat: e.target.value })} style={inputStyle}>
                  <option value="">Choose…</option>
                  {POST_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={!!draft.isAi} onChange={(e) => set({ isAi: e.target.checked })} style={{ width: 17, height: 17, accentColor: STYLES.wax }} /> AI-generated
        </label>

        <Field label="Who's in it">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {MEDIA_PEOPLE.map((p) => <ToggleChip key={p} active={draft.people.includes(p)} onClick={() => toggleIn("people", p)}>{p}</ToggleChip>)}
          </div>
        </Field>

        <Field label="Tags">
          {draft.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {draft.tags.map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: STYLES.purple, color: "#fff", borderRadius: 14, padding: "4px 6px 4px 12px", fontSize: 13 }}>
                  {t}
                  <button type="button" onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })} aria-label={`Remove ${t}`} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", padding: 0 }}><X size={14} /></button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} style={inputStyle} placeholder="Type a tag and press Enter (product, flatlay, box photo…)" />
            <button type="button" onClick={() => addTag(tagInput)} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14 }}>Add</button>
          </div>
          {unusedSuggestions.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: STYLES.slate }}>Already used:</span>
              {unusedSuggestions.map((t) => (
                <button key={t} type="button" onClick={() => addTag(t)} style={{ padding: "3px 10px", fontSize: 12, borderRadius: 12, cursor: "pointer", border: `1px solid ${STYLES.purple}66`, background: "#fff", color: STYLES.purple }}>+ {t}</button>
              ))}
            </div>
          )}
        </Field>

        <Field label="OneDrive link">
          <div style={{ display: "flex", gap: 6 }}>
            <input value={draft.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} style={inputStyle} placeholder="Paste the file's OneDrive share link" inputMode="url" />
            {draft.sourceUrl && /^https?:\/\//i.test(draft.sourceUrl) && (
              <a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Open link" style={{ ...selectStyle(), display: "flex", alignItems: "center", color: STYLES.ink }}><ExternalLink size={16} /></a>
            )}
          </div>
        </Field>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 200px" }}>
            <Field label="File name">
              <input value={draft.fileName} onChange={(e) => set({ fileName: e.target.value })} style={inputStyle} placeholder="IMG_1234.jpg" />
            </Field>
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <Field label="Date shot">
              <input type="date" value={draft.shotDate} onChange={(e) => set({ shotDate: e.target.value })} style={inputStyle} />
            </Field>
          </div>
        </div>

        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="Location, lighting, props, what worked…" />
        </Field>

        {error && <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: "8px 10px", borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          {!isNew ? (
            <button type="button" disabled={busy} onClick={() => onDelete(item)} style={{ ...selectStyle(), cursor: "pointer", color: STYLES.wax, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={14} /> Delete</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14, padding: "8px 14px" }}>Cancel</button>
            <button type="submit" disabled={busy} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : isNew ? "Add to library" : "Save changes"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
