import { useState, useEffect } from "react";
import { Save, MapPin, Plane } from "lucide-react";
import { STYLES, selectStyle, TRAVEL_MODES } from "../../constants";
import { AttachmentManager } from "../../components/Attachments";

export default function DatesTab({ meet, users, currentUser, onUpdate, setError }) {
  const [form, setForm] = useState(() => toForm(meet));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(toForm(meet)); setDirty(false); }, [meet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toForm(m) {
    const travel = {};
    users.forEach((u) => { travel[u] = { arrival: "", departure: "", mode: "Driving", notes: "", ...(m.travel?.[u] || {}) }; });
    return { title: m.title, startDate: m.startDate, endDate: m.endDate, location: m.location || "", address: m.address || "", notes: m.notes || "", travel };
  }

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); setDirty(true); }
  function setTravel(user, field, value) { setForm((f) => ({ ...f, travel: { ...f.travel, [user]: { ...f.travel[user], [field]: value } } })); setDirty(true); }

  async function save() {
    setSaving(true);
    try {
      await onUpdate({
        title: form.title.trim() || meet.title,
        startDate: form.startDate,
        endDate: form.endDate >= form.startDate ? form.endDate : form.startDate,
        location: form.location.trim(),
        address: form.address.trim(),
        notes: form.notes,
        travel: form.travel,
      });
      setDirty(false);
    } catch (e) { setError("Couldn't save: " + e.message); } finally { setSaving(false); }
  }

  async function persistAttachments(next) {
    try { await onUpdate({ attachments: next }); } catch (e) { setError("Couldn't update attachments: " + e.message); }
  }

  const label = { fontSize: 12, color: STYLES.slate, display: "block", marginBottom: 4 };
  const input = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Dates & Location</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Name</span>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} style={input} />
          </div>
          <div><span style={label}>Start date</span><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} style={input} /></div>
          <div><span style={label}>End date</span><input type="date" min={form.startDate} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} style={input} /></div>
          <div><span style={label}>Location / venue</span><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Cathy's house" style={input} /></div>
          <div><span style={label}>Address</span><input value={form.address} onChange={(e) => set("address", e.target.value)} style={input} /></div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>General notes</span>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </div>
      </section>

      <section style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Plane size={14} /> Travel Plans</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {users.map((u) => (
            <div key={u} style={{ border: `1px solid ${STYLES.ink}14`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{u}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><span style={label}>Arrival</span><input type="datetime-local" value={form.travel[u].arrival} onChange={(e) => setTravel(u, "arrival", e.target.value)} style={input} /></div>
                <div><span style={label}>Departure</span><input type="datetime-local" value={form.travel[u].departure} onChange={(e) => setTravel(u, "departure", e.target.value)} style={input} /></div>
                <div>
                  <span style={label}>Mode</span>
                  <select value={form.travel[u].mode} onChange={(e) => setTravel(u, "mode", e.target.value)} style={{ ...selectStyle(), width: "100%", boxSizing: "border-box" }}>
                    {TRAVEL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={label}>Notes (flight #, parking, etc.)</span>
                  <input value={form.travel[u].notes} onChange={(e) => setTravel(u, "notes", e.target.value)} style={input} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, marginBottom: 10 }}>Attachments (itineraries, confirmations, etc.)</div>
        <AttachmentManager folder={`raptrmeets/${meet.id}`} attachments={meet.attachments || []} onChange={persistAttachments} uploadedBy={currentUser} />
      </section>

      <div style={{ position: "sticky", bottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={!dirty || saving} style={{ background: dirty ? STYLES.wax : STYLES.slate, opacity: dirty ? 1 : 0.6, color: "#fff", border: "none", borderRadius: 4, padding: "10px 18px", cursor: dirty ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6, fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
          <Save size={15} /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </div>
  );
}
