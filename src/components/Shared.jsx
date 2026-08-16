import { useState } from "react";
import { ArrowDownUp, Info, X } from "lucide-react";
import {
  STYLES, IMPORTANCE_LEVELS, IMPORTANCE_LEGEND, URGENCY_LEVELS, URGENCY_LEGEND,
  importanceColor, urgencyColor, selectStyle,
} from "../constants";

export function SectionButton({ active, onClick, icon, label, showDot, dotColor }) {
  return (
    <button onClick={onClick} style={{ position: "relative", background: active ? STYLES.brass : "transparent", border: `1px solid ${STYLES.brass}`, color: active ? STYLES.ink : STYLES.parchment, fontWeight: active ? 700 : 400, borderRadius: 4, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      {icon} {label}
      {showDot && <span style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%", background: dotColor || STYLES.wax, border: "1.5px solid " + STYLES.ink }} />}
    </button>
  );
}

export function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{ flex: "0 0 auto", padding: "12px 18px", background: "transparent", border: "none", borderBottom: active ? `2px solid ${STYLES.wax}` : "2px solid transparent", color: active ? STYLES.ink : STYLES.slate, fontWeight: active ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, whiteSpace: "nowrap" }}>
      {icon} {label}
    </button>
  );
}

export function ImportanceSelect({ value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
      Importance
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...selectStyle(), color: importanceColor(value), fontWeight: 600 }}>
        {IMPORTANCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  );
}

export function UrgencyOrDueDateField({ mode, setMode, urgency, setUrgency, dueDate, setDueDate }) {
  const btnStyle = (active) => ({
    padding: "6px 10px", fontSize: 12, border: "none", cursor: "pointer",
    background: active ? STYLES.brass : "#fff", color: active ? STYLES.ink : STYLES.slate, fontWeight: active ? 700 : 400,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", border: `1px solid ${STYLES.ink}33`, borderRadius: 4, overflow: "hidden" }}>
        <button type="button" onClick={() => setMode("urgency")} style={btnStyle(mode === "urgency")}>Set urgency</button>
        <button type="button" onClick={() => setMode("dueDate")} style={btnStyle(mode === "dueDate")}>Set due date</button>
      </div>
      {mode === "urgency" ? (
        <UrgencySelect value={urgency} onChange={setUrgency} />
      ) : (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
          Due <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={selectStyle()} />
        </label>
      )}
    </div>
  );
}

export function UrgencySelect({ value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: STYLES.slate }}>
      Urgency
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...selectStyle(), color: urgencyColor(value), fontWeight: 600 }}>
        {URGENCY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  );
}

export function Badge({ label, color }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}55`, padding: "2px 8px", borderRadius: 10, background: `${color}14`, whiteSpace: "nowrap" }}>{label}</span>;
}

export function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ ...selectStyle(), color: STYLES.slate, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
        <Info size={13} /> {open ? "Hide legend" : "Urgency / Importance legend"}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 14, display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12.5, position: "absolute", zIndex: 20, width: "max-content", maxWidth: "80vw" }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: STYLES.ink }}>Urgency</div>
            {URGENCY_LEVELS.slice().reverse().map((l) => (
              <div key={l} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <span style={{ color: urgencyColor(l), fontWeight: 700, minWidth: 70 }}>{l}</span>
                <span style={{ color: STYLES.slate }}>{URGENCY_LEGEND[l]}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: STYLES.ink }}>Importance</div>
            {IMPORTANCE_LEVELS.slice().reverse().map((l) => (
              <div key={l} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <span style={{ color: importanceColor(l), fontWeight: 700, minWidth: 70 }}>{l}</span>
                <span style={{ color: STYLES.slate }}>{IMPORTANCE_LEGEND[l]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SortFilterBar({ sortBy, setSortBy, minImportance, setMinImportance, minUrgency, setMinUrgency, extraSort }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, color: STYLES.slate }}><ArrowDownUp size={13} /> Sort</span>
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle()}>
        <option value="priority">Priority (urgency + importance)</option>
        <option value="urgency">Urgency</option>
        <option value="importance">Importance</option>
        {extraSort}
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
      </select>
      <span style={{ color: STYLES.slate, marginLeft: 8 }}>Min urgency</span>
      <select value={minUrgency} onChange={(e) => setMinUrgency(e.target.value)} style={selectStyle()}>
        <option>Any</option>
        {URGENCY_LEVELS.map((l) => <option key={l}>{l}</option>)}
      </select>
      <span style={{ color: STYLES.slate }}>Min importance</span>
      <select value={minImportance} onChange={(e) => setMinImportance(e.target.value)} style={selectStyle()}>
        <option>Any</option>
        {IMPORTANCE_LEVELS.map((l) => <option key={l}>{l}</option>)}
      </select>
    </div>
  );
}

export function CenterMsg({ children }) {
  return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: STYLES.slate, fontFamily: "Georgia, serif" }}>{children}</div>;
}
export function EmptyMsg({ children }) {
  return <div style={{ textAlign: "center", color: STYLES.slate, padding: "40px 0", fontSize: 14 }}>{children}</div>;
}
export function ErrorBar({ children }) {
  if (!children) return null;
  return <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: "8px 24px", fontSize: 13 }}>{children}</div>;
}
