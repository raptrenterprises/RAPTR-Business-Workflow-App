import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { HeartHandshake, Settings, ArrowLeft } from "lucide-react";
import { STYLES, selectStyle, todayStr } from "../../constants";
import { CenterMsg, ErrorBar } from "../../components/Shared";
import {
  fetchMyPactVotes, submitPactVote, fetchPactHistory,
  fetchMyPactStatuses, setPactStatus, subscribePactVotes,
} from "../../lib/pactApi";
import {
  PACT_STATUSES, PACT_RESULTS, PACT_VERDICTS, MIN_INTEREST, MAX_INTEREST,
  validateInterest, pactMonthKey, pactMonthLabel, eteText,
} from "../../lib/pactLogic";
import CountersCard from "./CountersCard";

const PactHistoryChart = lazy(() => import("./PactHistoryChart"));

const cardStyle = { background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18 };
const primaryBtn = (disabled) => ({ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "10px 18px", cursor: disabled ? "default" : "pointer", fontSize: 14, opacity: disabled ? 0.6 : 1 });
const ghostBtn = { background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "10px 14px", cursor: "pointer", fontSize: 14 };
const linkBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", color: STYLES.slate, fontSize: 12, textDecoration: "underline" };

// Number box plus slider, kept in sync. The value is a string so the box can be empty.
function RatingInput({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input
        type="number" inputMode="numeric" min={MIN_INTEREST} max={MAX_INTEREST} step={1}
        value={value} placeholder={`${MIN_INTEREST}–${MAX_INTEREST}`}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...selectStyle(), width: 84, fontSize: 15 }}
      />
      <input
        type="range" min={MIN_INTEREST} max={MAX_INTEREST} step={1}
        value={value === "" ? 50 : value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Interest rating"
        style={{ flex: 1, accentColor: STYLES.wax }}
      />
    </div>
  );
}

// Your own rating. Nobody else, including your partner, is ever shown it.
function VoteForm({ initial, saving, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState("");

  function submit() {
    const msg = validateInterest(value);
    if (msg) { setProblem(msg); return; }
    setProblem("");
    onSubmit(Number(value));
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: STYLES.slate, marginBottom: 12 }}>
        Your vote is private. Once you've both voted, you'll each see only the result.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: STYLES.slate }}>
        Your interest rating ({MIN_INTEREST}–{MAX_INTEREST})
        <RatingInput value={value} onChange={setValue} />
      </div>
      {problem && <div style={{ marginTop: 12, fontSize: 13, color: STYLES.wax, fontWeight: 600 }}>{problem}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={saving} style={primaryBtn(saving)}>{saving ? "Saving…" : "Submit vote"}</button>
        {onCancel && <button onClick={onCancel} disabled={saving} style={ghostBtn}>Cancel</button>}
      </div>
    </div>
  );
}

// Just the verdict: Yes (green), Maybe (yellow) or No (red).
function VerdictBadge({ level }) {
  const v = PACT_VERDICTS[level];
  return (
    <div style={{ display: "inline-block", background: v.bg, color: v.fg, fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, padding: "8px 32px", borderRadius: 8 }}>
      {v.word}
    </div>
  );
}

// Your own relationship status. It sets the thresholds, so it lives here rather than in the monthly vote.
function StatusSettings({ initial, pending, saving, onSave, onClose }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ background: STYLES.brass + "14", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: STYLES.slate }}>
        Your relationship status
        <select value={value} onChange={(e) => setValue(e.target.value)} style={{ ...selectStyle(), fontSize: 15, color: STYLES.ink }}>
          <option value="">Select…</option>
          {PACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 8 }}>
        Applies to this month's score. Once you've both voted, a change applies from next month instead.
        {pending ? ` Already queued: ${pending.status} from ${pactMonthLabel(pending.effectiveMonth, true)}.` : ""}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => value && onSave(value)} disabled={saving || !value} style={primaryBtn(saving || !value)}>{saving ? "Saving…" : "Save"}</button>
        {onClose && <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>}
      </div>
    </div>
  );
}

// The full picture, behind "See more details": this month's result in words, then the estimate over time.
function DetailsView({ monthKey, resultRow, history, onBack }) {
  const result = resultRow ? PACT_RESULTS[resultRow.level] : null;
  const latest = history.length ? history[history.length - 1] : null;
  const hasChart = history.some((r) => r.eteDate);
  return (
    <>
      <button onClick={onBack} style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <ArrowLeft size={14} /> Back
      </button>

      {result && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: STYLES.slate, marginBottom: 8 }}>{pactMonthLabel(monthKey, true)}</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, color: STYLES.wax, marginBottom: 8 }}>
            {result.label}{result.emoji ? ` ${result.emoji}` : ""}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.5 }}>{result.recommendation}</div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Estimated time of enactment</div>
        {latest ? (
          <>
            <div style={{ fontSize: 22, fontFamily: "Georgia, serif", color: STYLES.wax, fontWeight: 700, margin: "6px 0 2px" }}>
              {latest.eteStatus === "estimated" ? pactMonthLabel(latest.eteDate) : eteText(latest)}
            </div>
            <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 12 }}>
              {latest.eteStatus === "estimated" ? `About ${Number(latest.monthsToGo.toFixed(1))} months out, as of the ${pactMonthLabel(latest.month, true)} vote.` : `As of the ${pactMonthLabel(latest.month, true)} vote.`}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: STYLES.slate, padding: "16px 0" }}>No results yet. An estimate appears once you've both voted, and gets sharper with each month.</div>
        )}

        {hasChart && (
          <Suspense fallback={<div style={{ fontSize: 12, color: STYLES.slate }}>Loading chart…</div>}>
            <PactHistoryChart rows={history} />
          </Suspense>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {history.slice().reverse().map((r) => (
              <div key={r.month} style={{ display: "flex", gap: 10, fontSize: 13, padding: "6px 8px", borderRadius: 4, background: STYLES.brass + "14", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, minWidth: 70 }}>{pactMonthLabel(r.month)}</span>
                <span style={{ flex: 1, minWidth: 140 }}>{PACT_RESULTS[r.level].label}{PACT_RESULTS[r.level].emoji ? ` ${PACT_RESULTS[r.level].emoji}` : ""}</span>
                <span style={{ color: STYLES.slate }}>{eteText(r)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 14, lineHeight: 1.5 }}>
          How it's worked out: each month's combined score is measured as a share of that month's Strong-interest threshold. The estimate draws a straight trend line through every month so far and extends it to 100%. It's a simple trend estimate from past votes, not a promise, and it needs two months of votes to start.
        </div>
      </div>
    </>
  );
}

export default function PactSection({ currentUser, users }) {
  const [myVotes, setMyVotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("main");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const monthKey = pactMonthKey(todayStr());

  const reload = useCallback(async () => {
    try {
      const [v, h, s] = await Promise.all([fetchMyPactVotes(), fetchPactHistory(), fetchMyPactStatuses()]);
      setMyVotes(v); setHistory(h); setStatuses(s);
      setError("");
    } catch (e) {
      setError("Couldn't load Pact: " + e.message + " (has migration 022_pact_private.sql been run?)");
    }
  }, [monthKey]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const u1 = subscribePactVotes(reload);
    // Your partner's vote can't be streamed to you (you're not allowed to see their rows), so refresh when you come back to the app.
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", reload);
    return () => { u1(); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", reload); };
  }, [reload]);

  const myVote = useMemo(() => myVotes.find((v) => v.month === monthKey) || null, [myVotes, monthKey]);
  const resultRow = useMemo(() => history.find((h) => h.month === monthKey) || null, [history, monthKey]);
  const currentStatus = useMemo(() => statuses.filter((s) => s.effectiveMonth <= monthKey).slice(-1)[0] || null, [statuses, monthKey]);
  const pendingStatus = useMemo(() => statuses.filter((s) => s.effectiveMonth > monthKey).slice(-1)[0] || null, [statuses, monthKey]);
  const other = users.find((u) => u !== currentUser) || "your partner";
  const showSettings = settingsOpen || !currentStatus;

  // Polling only while we're waiting on the other person's vote.
  const waiting = !!myVote && !resultRow;
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [waiting, reload]);

  async function submit(interest) {
    setSaving(true);
    try { await submitPactVote(interest); await reload(); setEditing(false); }
    catch (e) { setError("Couldn't save the vote: " + e.message); }
    finally { setSaving(false); }
  }
  async function saveStatus(status) {
    setStatusSaving(true);
    try { await setPactStatus(status); await reload(); setSettingsOpen(false); }
    catch (e) { setError("Couldn't save the status: " + e.message); }
    finally { setStatusSaving(false); }
  }

  if (loading) return <CenterMsg>Loading Pact…</CenterMsg>;

  let voteBody;
  if (!currentStatus) {
    voteBody = <div style={{ fontSize: 13, color: STYLES.slate }}>Set your relationship status above before your first vote.</div>;
  } else if (resultRow) {
    voteBody = (
      <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
        <VerdictBadge level={resultRow.level} />
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setView("details")} style={primaryBtn(false)}>See more details</button>
        </div>
        <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 12 }}>You've both voted, so this month's votes are locked.</div>
      </div>
    );
  } else if (myVote && !editing) {
    voteBody = (
      <>
        <div style={{ fontSize: 15, marginBottom: 10 }}>Your vote is in. Waiting for {other}.</div>
        <button onClick={() => setEditing(true)} style={linkBtn}>Change my vote</button>
        <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 10 }}>You can change it until {other} votes.</div>
      </>
    );
  } else {
    voteBody = (
      <VoteForm key={myVote ? "edit" : "new"} initial={myVote ? String(myVote.interest) : ""} saving={saving} onSubmit={submit} onCancel={myVote ? () => setEditing(false) : null} />
    );
  }

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        {view === "details" ? (
          <DetailsView monthKey={monthKey} resultRow={resultRow} history={history} onBack={() => setView("main")} />
        ) : (
          <>
            <CountersCard currentUser={currentUser} users={users} />

            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700 }}>
                  <HeartHandshake size={18} color={STYLES.wax} /> Pact · {pactMonthLabel(monthKey, true)}
                </div>
                <button onClick={() => setSettingsOpen((o) => !o)} aria-label="Pact settings" title="Pact settings" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex", padding: 4 }}>
                  <Settings size={18} />
                </button>
              </div>
              {showSettings && (
                <StatusSettings
                  key={currentStatus ? currentStatus.status : "none"}
                  initial={pendingStatus ? pendingStatus.status : (currentStatus ? currentStatus.status : "")}
                  pending={pendingStatus} saving={statusSaving} onSave={saveStatus}
                  onClose={currentStatus ? () => setSettingsOpen(false) : null}
                />
              )}
              {voteBody}
              {!resultRow && history.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => setView("details")} style={linkBtn}>See more details</button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
