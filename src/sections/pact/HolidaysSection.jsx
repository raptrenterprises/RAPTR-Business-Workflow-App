import { useState, useEffect, useCallback } from "react";
import { Settings, ArrowLeft } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { CenterMsg, ErrorBar } from "../../components/Shared";
import { fetchHolidays, saveHoliday, subscribeHolidays } from "../../lib/rrApi";
import { parseRichText, nextTenYear, yearsAwayText, validYearInput, currentYear, FIRST_YEAR_MIN, FIRST_YEAR_MAX } from "../../lib/rrLogic";

const cardStyle = { background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18 };
const primaryBtn = (disabled) => ({ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "10px 18px", cursor: disabled ? "default" : "pointer", fontSize: 14, opacity: disabled ? 0.6 : 1 });
const ghostBtn = { background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "10px 14px", cursor: "pointer", fontSize: 14 };
const textareaStyle = { ...selectStyle(), width: "100%", boxSizing: "border-box", minHeight: 150, fontSize: 14, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical" };

// Read-only text: bullet lines become a list, everything else stays plain text.
function RichText({ text, empty }) {
  const blocks = parseRichText(text);
  if (blocks.length === 0) return <div style={{ fontSize: 14, color: STYLES.slate, fontStyle: "italic" }}>{empty}</div>;
  return (
    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
      {blocks.map((b, i) => {
        if (b.type === "gap") return <div key={i} style={{ height: 8 }} />;
        if (b.type === "text") return <div key={i}>{b.text}</div>;
        return (
          <div key={i} style={{ display: "flex", gap: 8, marginLeft: b.level * 18 }}>
            <span style={{ color: STYLES.wax, flexShrink: 0 }}>{b.level > 0 ? "◦" : "•"}</span>
            <span>{b.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function HolidayCard({ holiday, onOpen }) {
  const upcoming = nextTenYear(holiday.firstYear);
  return (
    <button onClick={() => onOpen(holiday.id)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", gap: 6, minHeight: 92 }}>
      <span style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: STYLES.ink }}>{holiday.name}</span>
      <span style={{ fontSize: 12, color: STYLES.slate }}>
        {upcoming != null ? `Upcoming 10 yr: ${upcoming}` : "Year of first celebration not set"}
      </span>
    </button>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ ...cardStyle, marginTop: 16 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${STYLES.wax}` }}>{title}</div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
      <div style={{ fontSize: 13, color: STYLES.slate, minWidth: 150 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

// One holiday. Read-only until the gear is tapped; then text boxes and the year field appear.
function HolidayDetail({ holiday, onBack, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [problem, setProblem] = useState("");

  function startEditing() {
    setDraft({ requiredElements: holiday.requiredElements, anniversaryNotes: holiday.anniversaryNotes, firstYear: holiday.firstYear == null ? "" : String(holiday.firstYear) });
    setProblem("");
    setEditing(true);
  }
  function cancel() { setEditing(false); setDraft(null); setProblem(""); }

  async function save() {
    if (!validYearInput(draft.firstYear)) { setProblem(`The year must be a whole number from ${FIRST_YEAR_MIN} to ${FIRST_YEAR_MAX}, or left empty.`); return; }
    const ok = await onSave(holiday.id, { requiredElements: draft.requiredElements, anniversaryNotes: draft.anniversaryNotes, firstYear: draft.firstYear === "" ? null : Number(draft.firstYear) });
    if (ok) cancel();
  }

  // While editing, "Upcoming 10 yr" follows what's typed in the year box.
  const shownFirstYear = editing ? (draft.firstYear === "" || !validYearInput(draft.firstYear) ? null : Number(draft.firstYear)) : holiday.firstYear;
  const upcoming = nextTenYear(shownFirstYear);

  return (
    <>
      <button onClick={onBack} style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700 }}>{holiday.name}</div>
        <button onClick={editing ? cancel : startEditing} aria-label={editing ? "Stop editing" : "Edit this page"} title={editing ? "Stop editing" : "Edit this page"}
          style={{ background: editing ? STYLES.wax : "none", color: editing ? "#fff" : STYLES.slate, border: "none", borderRadius: 4, cursor: "pointer", display: "flex", padding: 6 }}>
          <Settings size={20} />
        </button>
      </div>

      <SectionCard title="Required Elements">
        {editing ? (
          <>
            <textarea value={draft.requiredElements} onChange={(e) => setDraft((d) => ({ ...d, requiredElements: e.target.value }))} style={textareaStyle} aria-label="Required Elements" />
            <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 4 }}>Start a line with - for a bullet. Indent two spaces for a sub-bullet. Anything else is plain text.</div>
          </>
        ) : (
          <RichText text={holiday.requiredElements} empty="Nothing added yet. Tap the gear to add details." />
        )}
      </SectionCard>

      <SectionCard title="10 yr Anniversary">
        {editing ? (
          <>
            <textarea value={draft.anniversaryNotes} onChange={(e) => setDraft((d) => ({ ...d, anniversaryNotes: e.target.value }))} style={textareaStyle} aria-label="10 yr Anniversary" />
            <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 4 }}>Start a line with - for a bullet. Indent two spaces for a sub-bullet. Anything else is plain text.</div>
          </>
        ) : (
          <RichText text={holiday.anniversaryNotes} empty="Nothing added yet. Tap the gear to add details." />
        )}

        <FieldRow label="Year of First Celebration">
          {editing ? (
            <input type="number" inputMode="numeric" min={FIRST_YEAR_MIN} max={FIRST_YEAR_MAX} step={1} value={draft.firstYear} placeholder="e.g. 2016"
              onChange={(e) => setDraft((d) => ({ ...d, firstYear: e.target.value }))} aria-label="Year of First Celebration"
              style={{ ...selectStyle(), width: 110, fontSize: 15 }} />
          ) : (
            holiday.firstYear != null ? holiday.firstYear : <span style={{ color: STYLES.slate, fontWeight: 400, fontStyle: "italic" }}>Not set</span>
          )}
        </FieldRow>
        <FieldRow label="Upcoming 10 yr">
          {upcoming != null ? (
            <span>{upcoming} <span style={{ fontSize: 12, color: STYLES.slate, fontWeight: 400 }}>({yearsAwayText(upcoming, currentYear())})</span></span>
          ) : (
            <span style={{ color: STYLES.slate, fontWeight: 400, fontStyle: "italic" }}>Add the year of the first celebration</span>
          )}
        </FieldRow>
      </SectionCard>

      {editing && (
        <div style={{ marginTop: 16 }}>
          {problem && <div style={{ fontSize: 13, color: STYLES.wax, fontWeight: 600, marginBottom: 10 }}>{problem}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={primaryBtn(saving)}>{saving ? "Saving…" : "Save"}</button>
            <button onClick={cancel} disabled={saving} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function HolidaysSection() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try { setHolidays(await fetchHolidays()); setError(""); }
    catch (e) { setError("Couldn't load Holidays: " + e.message + " (has migration 024 been run?)"); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    return subscribeHolidays(reload);
  }, [reload]);

  async function save(id, values) {
    setSaving(true);
    try { await saveHoliday(id, values); await reload(); return true; }
    catch (e) { setError("Couldn't save: " + e.message); return false; }
    finally { setSaving(false); }
  }

  if (loading) return <CenterMsg>Loading Holidays…</CenterMsg>;
  const open = holidays.find((h) => h.id === openId) || null;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        {open ? (
          <HolidayDetail key={open.id} holiday={open} onBack={() => setOpenId(null)} onSave={save} saving={saving} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {holidays.map((h) => <HolidayCard key={h.id} holiday={h} onOpen={setOpenId} />)}
          </div>
        )}
      </main>
    </>
  );
}
