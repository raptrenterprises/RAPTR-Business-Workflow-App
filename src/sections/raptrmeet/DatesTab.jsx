import { useState, useEffect } from "react";
import { Save, MapPin, Plane, Home } from "lucide-react";
import { STYLES, selectStyle, TRAVEL_MODES, TIMEBLOCKS } from "../../constants";
import { AttachmentManager } from "../../components/Attachments";

// Flying/Train travel is a specific day+time+location; Driving/Other travel
// is looser — just a day and a rough time of day.
const LOCATION_LABEL = { Flying: "Airport", Train: "Station" };
function usesPreciseTime(mode) { return mode === "Flying" || mode === "Train"; }

function emptyLeg() { return { day: "", time: "", timeblock: "", location: "" }; }

const fieldLabel = { fontSize: 12, color: STYLES.slate, display: "block", marginBottom: 4 };
const fieldInput = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 14, minWidth: 0 };
// auto-fit lets narrow phone screens drop to 1 column per row instead of
// squeezing 2-3 fixed columns and overflowing the viewport.
const responsiveGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };

// Hoisted to module scope (not defined inside DatesTab) so React keeps the
// same component identity across re-renders — otherwise every keystroke
// would remount these inputs and drop focus.
function LegFields({ leg, legLabel, mode, value, onChange }) {
  if (usesPreciseTime(mode)) {
    return (
      <div style={responsiveGrid}>
        <div><span style={fieldLabel}>{legLabel} day</span><input type="date" value={value.day} onChange={(e) => onChange(leg, "day", e.target.value)} style={fieldInput} /></div>
        <div><span style={fieldLabel}>{legLabel} time</span><input type="time" value={value.time} onChange={(e) => onChange(leg, "time", e.target.value)} style={fieldInput} /></div>
        <div><span style={fieldLabel}>{LOCATION_LABEL[mode]}</span><input value={value.location} onChange={(e) => onChange(leg, "location", e.target.value)} placeholder={LOCATION_LABEL[mode]} style={fieldInput} /></div>
      </div>
    );
  }
  return (
    <div style={responsiveGrid}>
      <div><span style={fieldLabel}>{legLabel} day</span><input type="date" value={value.day} onChange={(e) => onChange(leg, "day", e.target.value)} style={fieldInput} /></div>
      <div>
        <span style={fieldLabel}>{legLabel} time of day</span>
        <select value={value.timeblock} onChange={(e) => onChange(leg, "timeblock", e.target.value)} style={{ ...selectStyle(), width: "100%", boxSizing: "border-box" }}>
          <option value="">Not sure yet</option>
          {TIMEBLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// Normalizes one person's travel entry to the current shape, migrating the
// old flat datetime-local arrival/departure strings (if present) into notes
// so nothing silently disappears for RAPTRMeets created before this update.
function normalizeTravel(raw) {
  const base = { isHost: false, mode: "Driving", arrival: emptyLeg(), departure: emptyLeg(), notes: "" };
  if (!raw) return base;
  const out = { ...base, ...raw };
  const legacyBits = [];
  if (typeof raw.arrival === "string" && raw.arrival) legacyBits.push(`Old arrival: ${raw.arrival}`);
  if (typeof raw.departure === "string" && raw.departure) legacyBits.push(`Old departure: ${raw.departure}`);
  out.arrival = { ...emptyLeg(), ...(raw.arrival && typeof raw.arrival === "object" ? raw.arrival : {}) };
  out.departure = { ...emptyLeg(), ...(raw.departure && typeof raw.departure === "object" ? raw.departure : {}) };
  if (legacyBits.length) out.notes = [raw.notes, ...legacyBits].filter(Boolean).join(" · ");
  return out;
}

export default function DatesTab({ meet, users, currentUser, onUpdate, setError }) {
  const [form, setForm] = useState(() => toForm(meet));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(toForm(meet)); setDirty(false); }, [meet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toForm(m) {
    const travel = {};
    users.forEach((u) => { travel[u] = normalizeTravel(m.travel?.[u]); });
    return { title: m.title, startDate: m.startDate, endDate: m.endDate, location: m.location || "", address: m.address || "", notes: m.notes || "", travel };
  }

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); setDirty(true); }
  function setTravel(user, field, value) { setForm((f) => ({ ...f, travel: { ...f.travel, [user]: { ...f.travel[user], [field]: value } } })); setDirty(true); }
  function setLeg(user, leg, field, value) { setForm((f) => ({ ...f, travel: { ...f.travel, [user]: { ...f.travel[user], [leg]: { ...f.travel[user][leg], [field]: value } } } })); setDirty(true); }

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

  const label = fieldLabel;
  const input = fieldInput;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Dates & Location</div>
        <div style={{ ...responsiveGrid, marginBottom: 10 }}>
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
          {users.map((u) => {
            const t = form.travel[u];
            return (
              <div key={u} style={{ border: `1px solid ${STYLES.ink}14`, borderRadius: 4, padding: 12, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: t.isHost ? 0 : 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u}</div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: STYLES.slate, cursor: "pointer" }}>
                    <input type="checkbox" checked={t.isHost} onChange={(e) => setTravel(u, "isHost", e.target.checked)} /> <Home size={12} /> Hosting (no travel)
                  </label>
                </div>
                {!t.isHost && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ maxWidth: 220 }}>
                      <span style={label}>Mode</span>
                      <select value={t.mode} onChange={(e) => setTravel(u, "mode", e.target.value)} style={{ ...selectStyle(), width: "100%", boxSizing: "border-box" }}>
                        {TRAVEL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: STYLES.slate, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Arrival</div>
                      <LegFields leg="arrival" legLabel="Arrival" mode={t.mode} value={t.arrival} onChange={(leg, field, value) => setLeg(u, leg, field, value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: STYLES.slate, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Departure</div>
                      <LegFields leg="departure" legLabel="Departure" mode={t.mode} value={t.departure} onChange={(leg, field, value) => setLeg(u, leg, field, value)} />
                    </div>
                    <div>
                      <span style={label}>Notes (flight #, parking, etc.)</span>
                      <input value={t.notes} onChange={(e) => setTravel(u, "notes", e.target.value)} style={input} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
