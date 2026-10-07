import { useState } from "react";
import { X } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { saveLocation } from "../../lib/mediaApi";

const inputStyle = { ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px" };

function Row({ title, hint, value, onChange }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 10, marginBottom: 12 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 15, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>{hint}</div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 }}>Folder link or server address</label>
      <input value={value.baseUrl} onChange={(e) => onChange({ ...value, baseUrl: e.target.value })} placeholder="https://…" inputMode="url" style={{ ...inputStyle, marginBottom: 8 }} />
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 }}>What the link does</label>
      <select value={value.linkStyle} onChange={(e) => onChange({ ...value, linkStyle: e.target.value })} style={inputStyle}>
        <option value="folder">Opens the folder (OneDrive share link)</option>
        <option value="path">Builds the file's address from its path (a server)</option>
      </select>
    </div>
  );
}

export default function StorageLocationsForm({ locations, onSaved, onClose }) {
  const [raw, setRaw] = useState(locations.raw);
  const [edited, setEdited] = useState(locations.edited);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    for (const v of [raw, edited]) {
      if (v.baseUrl.trim() && !/^https?:\/\//i.test(v.baseUrl.trim())) { setError("Links should start with https://"); return; }
    }
    setBusy(true);
    setError("");
    try {
      await saveLocation("raw", raw.baseUrl.trim(), raw.linkStyle);
      await saveLocation("edited", edited.baseUrl.trim(), edited.linkStyle);
      onSaved();
    } catch (err) {
      setError("Couldn't save: " + err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 520, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>Storage locations</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.ink }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 13, color: STYLES.slate, marginBottom: 12 }}>
          Where your media files live. Items open from here, so moving to a different storage later only means changing these two settings. Items with their own direct link keep it.
        </div>
        <Row title="raw folder" hint="Unedited photos and video. For OneDrive, share the raw folder and paste its link." value={raw} onChange={setRaw} />
        <Row title="edited folder" hint="Finished exports. For OneDrive, share the edited folder and paste its link." value={edited} onChange={setEdited} />
        {error && <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: "8px 10px", borderRadius: 4, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14, padding: "8px 14px" }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
