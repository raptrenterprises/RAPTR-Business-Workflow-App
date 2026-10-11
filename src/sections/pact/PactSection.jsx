import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { HeartHandshake, History } from "lucide-react";
import { STYLES, selectStyle, todayStr } from "../../constants";
import { TabButton, CenterMsg, ErrorBar } from "../../components/Shared";
import { fetchPactVotes, savePactVote, subscribePactVotes } from "../../lib/pactApi";
import {
  PACT_STATUSES, PACT_RESULTS, MIN_INTEREST, MAX_INTEREST,
  calcPact, validateBallots, cleanBallots, pactMonthKey, pactMonthLabel,
} from "../../lib/pactLogic";

const PactHistoryChart = lazy(() => import("./PactHistoryChart"));

const cardStyle = { background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18 };

function emptyDraft(users) {
  const d = {};
  users.forEach((u) => { d[u] = { status: "", interest: "" }; });
  return d;
}

// Existing ballots -> editable draft (interest as a string, like the inputs hold it).
function draftFrom(ballots, users) {
  const d = {};
  users.forEach((u) => {
    const b = ballots[u] || {};
    d[u] = { status: b.status || "", interest: b.interest != null ? String(b.interest) : "" };
  });
  return d;
}

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

function ParticipantFields({ name, value, onChange }) {
  return (
    <div style={{ border: `1px solid ${STYLES.ink}1f`, borderRadius: 6, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700 }}>{name}</div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: STYLES.slate }}>
        Relationship status
        <select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })} style={{ ...selectStyle(), fontSize: 15, color: STYLES.ink }}>
          <option value="">Select…</option>
          {PACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: STYLES.slate }}>
        Interest rating ({MIN_INTEREST}–{MAX_INTEREST})
        <RatingInput value={value.interest} onChange={(interest) => onChange({ ...value, interest })} />
      </div>
    </div>
  );
}

function VoteForm({ users, monthKey, initial, saving, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => initial || emptyDraft(users));
  const [problem, setProblem] = useState("");

  function submit() {
    const msg = validateBallots(draft, users);
    if (msg) { setProblem(msg); return; }
    setProblem("");
    onSubmit(cleanBallots(draft, users));
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
        <HeartHandshake size={18} color={STYLES.wax} /> {pactMonthLabel(monthKey, true)} vote
      </div>
      <div style={{ fontSize: 13, color: STYLES.slate, marginBottom: 14 }}>
        One vote a month. Each of you picks a status and an interest rating.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {users.map((u) => (
          <ParticipantFields key={u} name={u} value={draft[u]} onChange={(next) => setDraft((d) => ({ ...d, [u]: next }))} />
        ))}
      </div>
      {problem && <div style={{ marginTop: 12, fontSize: 13, color: STYLES.wax, fontWeight: 600 }}>{problem}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={saving} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "10px 18px", cursor: saving ? "default" : "pointer", fontSize: 14, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Submit vote"}
        </button>
        {onCancel && (
          <button onClick={onCancel} disabled={saving} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "10px 14px", cursor: "pointer", fontSize: 14 }}>Cancel</button>
        )}
      </div>
    </div>
  );
}

// Category and recommendation only. No score, no thresholds, no individual ratings.
function ResultCard({ monthKey, result, onChange }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: STYLES.slate, marginBottom: 8 }}>{pactMonthLabel(monthKey, true)}</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, color: STYLES.wax, marginBottom: 8 }}>
        {result.label}{result.emoji ? ` ${result.emoji}` : ""}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 16 }}>{result.recommendation}</div>
      <button onClick={onChange} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: STYLES.slate, fontSize: 12, textDecoration: "underline" }}>
        Change this month's vote
      </button>
    </div>
  );
}

export default function PactSection({ currentUser, users }) {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("vote");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try { setVotes(await fetchPactVotes()); setError(""); }
    catch (e) { setError("Couldn't load Pact: " + e.message + " (has migration 021_pact.sql been run?)"); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    return subscribePactVotes(reload);
  }, [reload]);

  const monthKey = pactMonthKey(todayStr());
  const thisMonthVote = useMemo(() => votes.find((v) => v.month === monthKey) || null, [votes, monthKey]);
  const result = thisMonthVote ? PACT_RESULTS[calcPact(thisMonthVote.ballots, users).level] : null;

  async function submit(ballots) {
    setSaving(true);
    try {
      await savePactVote({ month: monthKey, ballots, submittedBy: currentUser });
      await reload();
      setEditing(false);
    } catch (e) {
      setError("Couldn't save the vote: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CenterMsg>Loading Pact…</CenterMsg>;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <div style={{ display: "flex", borderBottom: `1px solid ${STYLES.ink}22`, background: "#fff", overflowX: "auto" }}>
        <TabButton active={tab === "vote"} onClick={() => setTab("vote")} icon={<HeartHandshake size={14} />} label="Vote" />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={<History size={14} />} label="History" />
      </div>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        {tab === "vote" && (
          thisMonthVote && !editing ? (
            <ResultCard monthKey={monthKey} result={result} onChange={() => setEditing(true)} />
          ) : (
            <VoteForm
              key={thisMonthVote ? thisMonthVote.id : "new"}
              users={users} monthKey={monthKey} saving={saving} onSubmit={submit}
              initial={thisMonthVote ? draftFrom(thisMonthVote.ballots, users) : null}
              onCancel={thisMonthVote ? () => setEditing(false) : null}
            />
          )
        )}

        {tab === "history" && (
          <div style={cardStyle}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>History</div>
            <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 12 }}>
              A record of past monthly votes: combined score against the moderate and strong thresholds. It describes what happened; it isn't a forecast.
            </div>
            {votes.length === 0 ? (
              <div style={{ fontSize: 13, color: STYLES.slate, padding: "20px 0", textAlign: "center" }}>No votes yet.</div>
            ) : (
              <Suspense fallback={<div style={{ fontSize: 12, color: STYLES.slate }}>Loading chart…</div>}>
                <PactHistoryChart votes={votes} users={users} />
              </Suspense>
            )}
          </div>
        )}
      </main>
    </>
  );
}
