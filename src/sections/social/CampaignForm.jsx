import { useState } from "react";
import { X, Trash2, Plus, Unlink } from "lucide-react";
import { STYLES, uid, selectStyle, formatClockTime } from "../../constants";
import { STATUS_LABEL, STATUS_COLOR, formatPostDate, typeColor } from "./socialConstants";

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

export default function CampaignForm({ campaign, posts, allPosts, currentUser, onSave, onDelete, onClose, onOpenPost, onNewPost, onLinkPost, onUnlinkPost }) {
  const isNew = !campaign;
  const [draft, setDraft] = useState(campaign ? { ...campaign } : { id: uid(), name: "", description: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkId, setLinkId] = useState("");
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const unlinked = allPosts.filter((p) => !p.campaignId);

  async function submit(e) {
    e.preventDefault();
    if (!draft.name.trim()) { setError("Give this campaign a name."); return; }
    setBusy(true);
    setError("");
    try {
      await onSave({ ...draft, name: draft.name.trim(), createdBy: currentUser, createdAt: new Date().toISOString() }, isNew);
    } catch (err) {
      setError("Couldn't save: " + err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 560, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{isNew ? "New campaign" : "Edit campaign"}</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.ink }}><X size={20} /></button>
        </div>

        <Field label="Name">
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} style={inputStyle} placeholder="e.g. Love Story series" />
        </Field>
        <Field label="Description">
          <textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="What is this campaign, and what's it for?" />
        </Field>
        <Field label="Notes">
          <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="Goals, themes, hashtags, what worked…" />
        </Field>

        {!isNew && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Posts in this campaign ({posts.length})</label>
            {posts.length === 0 && <div style={{ fontSize: 13, color: STYLES.slate, marginBottom: 8 }}>No posts linked yet.</div>}
            {posts.map((p) => {
              const c = STATUS_COLOR[p.status];
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${STYLES.ink}22`, borderLeft: `4px solid ${typeColor(p.postType)}`, borderRadius: 6, padding: "7px 10px", marginBottom: 6 }}>
                  <div onClick={() => onOpenPost(p)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, wordBreak: "break-word" }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: STYLES.slate }}>{p.postType}{p.publishDate ? ` · ${formatPostDate(p.publishDate)}${p.publishTime ? ` ${formatClockTime(p.publishTime)}` : ""}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: c, border: `1px solid ${c}66`, background: `${c}14`, padding: "2px 9px", borderRadius: 10, whiteSpace: "normal", textAlign: "center", lineHeight: 1.25, maxWidth: 110, flexShrink: 0 }}>{STATUS_LABEL[p.status]}</span>
                  <button type="button" onClick={() => onUnlinkPost(p)} aria-label="Remove from campaign" title="Remove from campaign" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex" }}><Unlink size={15} /></button>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={() => onNewPost(campaign.id)} style={{ ...selectStyle(), cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Plus size={14} /> New post in this campaign</button>
              {unlinked.length > 0 && (
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={linkId} onChange={(e) => setLinkId(e.target.value)} style={{ ...selectStyle(), maxWidth: 220 }}>
                    <option value="">Add an existing post…</option>
                    {unlinked.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  {linkId && <button type="button" onClick={() => { onLinkPost(linkId, campaign.id); setLinkId(""); }} style={{ ...selectStyle(), cursor: "pointer", fontWeight: 600 }}>Add</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: "8px 10px", borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          {!isNew ? (
            <button type="button" disabled={busy} onClick={() => onDelete(campaign)} style={{ ...selectStyle(), cursor: "pointer", color: STYLES.wax, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={14} /> Delete</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14, padding: "8px 14px" }}>Close</button>
            <button type="submit" disabled={busy} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : isNew ? "Create campaign" : "Save changes"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
