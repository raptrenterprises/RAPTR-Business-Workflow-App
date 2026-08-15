import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Save, X, Dumbbell, Check } from "lucide-react";
import { STYLES, uid, todayStr, selectStyle } from "../constants";
import { CenterMsg, EmptyMsg, ErrorBar } from "../components/Shared";
import { fetchChallenges, insertChallenge, updateChallenge, subscribeChallenges } from "../lib/gymApi";

const MS_DAY = 86400000;

function emptyParticipant() {
  return { startingWeight: null, targetWeight: null, weighIns: [], workoutDates: [] };
}

function weekIndexForDate(startDate, dateStr) {
  const start = new Date(startDate + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  return Math.floor((d - start) / (7 * MS_DAY));
}

function totalWeeks(startDate, endDate) {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  return Math.max(1, Math.ceil((end - start) / (7 * MS_DAY)));
}

function targetForWeek(participant, weeks, weekIdx) {
  const { startingWeight, targetWeight } = participant;
  if (startingWeight == null || targetWeight == null) return null;
  const frac = Math.min(1, (weekIdx + 1) / weeks);
  return startingWeight + (targetWeight - startingWeight) * frac;
}

function weightStatus(target, actual, startingWeight) {
  if (target == null || actual == null) return "none";
  const losing = startingWeight != null && target < startingWeight;
  const gaining = startingWeight != null && target > startingWeight;
  const diff = actual - target;
  const tol = 1;
  if (losing) {
    if (diff <= tol) return "good";
    if (diff <= tol * 3) return "warn";
    return "bad";
  }
  if (gaining) {
    if (diff >= -tol) return "good";
    if (diff >= -tol * 3) return "warn";
    return "bad";
  }
  return Math.abs(diff) <= tol ? "good" : "warn";
}

const STATUS_COLOR = { good: STYLES.green, warn: STYLES.brass, bad: STYLES.wax, none: STYLES.gray };

export default function GymSection({ currentUser, users }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ startDate: todayStr(), endDate: "", targetWorkoutsPerWeek: 3 });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setChallenges(await fetchChallenges()); } catch (e) { setError("Couldn't load challenges: " + e.message); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const unsubscribe = subscribeChallenges(reload);
    return unsubscribe;
  }, [reload]);

  async function startChallenge() {
    if (!draft.startDate || !draft.endDate) return;
    const participants = {};
    users.forEach((u) => { participants[u] = emptyParticipant(); });
    const challenge = { id: uid(), startDate: draft.startDate, endDate: draft.endDate, targetWorkoutsPerWeek: Number(draft.targetWorkoutsPerWeek) || 1, createdBy: currentUser, createdAt: new Date().toISOString(), participants };
    setDraft({ startDate: todayStr(), endDate: "", targetWorkoutsPerWeek: 3 });
    setComposing(false);
    try { await insertChallenge(challenge); reload(); } catch (e) { setError("Couldn't start challenge: " + e.message); }
  }

  function startEditChallenge(c) {
    setEditingId(c.id);
    setEditDraft({ startDate: c.startDate, endDate: c.endDate, targetWorkoutsPerWeek: c.targetWorkoutsPerWeek });
  }

  async function saveEditChallenge(id) {
    try {
      await updateChallenge(id, { startDate: editDraft.startDate, endDate: editDraft.endDate, targetWorkoutsPerWeek: Number(editDraft.targetWorkoutsPerWeek) || 1 });
      setEditingId(null); setEditDraft(null); reload();
    } catch (e) { setError("Couldn't save changes: " + e.message); }
  }

  async function patchParticipant(challenge, user, patch) {
    const nextParticipants = { ...challenge.participants, [user]: { ...challenge.participants[user], ...patch } };
    try { await updateChallenge(challenge.id, { participants: nextParticipants }); reload(); } catch (e) { setError("Couldn't save: " + e.message); }
  }

  async function logWeighIn(challenge, user, weekIdx, weight) {
    const p = challenge.participants[user];
    const others = p.weighIns.filter((w) => w.week !== weekIdx);
    const weighIns = [...others, { week: weekIdx, weight, at: new Date().toISOString() }].sort((a, b) => a.week - b.week);
    await patchParticipant(challenge, user, { weighIns });
  }

  async function toggleWorkoutDate(challenge, user, dateStr) {
    const p = challenge.participants[user];
    const has = p.workoutDates.includes(dateStr);
    const workoutDates = has ? p.workoutDates.filter((d) => d !== dateStr) : [...p.workoutDates, dateStr];
    await patchParticipant(challenge, user, { workoutDates });
  }

  if (loading) return <CenterMsg>Loading RAPTR Gym…</CenterMsg>;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>
        {composing ? (
          <div style={{ background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
              Start <input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} style={selectStyle()} />
            </label>
            <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
              End <input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} style={selectStyle()} />
            </label>
            <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
              Workouts/week <input type="number" min={1} max={14} value={draft.targetWorkoutsPerWeek} onChange={(e) => setDraft({ ...draft, targetWorkoutsPerWeek: e.target.value })} style={{ ...selectStyle(), width: 56 }} />
            </label>
            <button onClick={startChallenge} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Start Challenge</button>
            <button onClick={() => setComposing(false)} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}><X size={14} /></button>
          </div>
        ) : (
          <button onClick={() => setComposing(true)} style={{ width: "100%", background: "#fff", border: `1px dashed ${STYLES.brass}`, borderRadius: 6, padding: "14px", cursor: "pointer", color: STYLES.slate, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
            <Dumbbell size={16} /> Start a RAPTR Gym challenge
          </button>
        )}

        {challenges.length === 0 ? (
          <EmptyMsg>No challenges yet — start one above.</EmptyMsg>
        ) : (
          challenges.map((c) => {
            const isEditing = editingId === c.id;
            const weeks = totalWeeks(c.startDate, c.endDate);
            const today = todayStr();
            const currentWeek = Math.min(weeks - 1, Math.max(0, weekIndexForDate(c.startDate, today)));
            const isActive = today >= c.startDate && today <= c.endDate;

            return (
              <div key={c.id} style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18, marginBottom: 18 }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
                      Start <input type="date" value={editDraft.startDate} onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })} style={selectStyle()} />
                    </label>
                    <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
                      End <input type="date" value={editDraft.endDate} onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })} style={selectStyle()} />
                    </label>
                    <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
                      Workouts/week <input type="number" min={1} max={14} value={editDraft.targetWorkoutsPerWeek} onChange={(e) => setEditDraft({ ...editDraft, targetWorkoutsPerWeek: e.target.value })} style={{ ...selectStyle(), width: 56 }} />
                    </label>
                    <button onClick={() => saveEditChallenge(c.id)} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}><Save size={13} /> Save</button>
                    <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "7px 10px", cursor: "pointer" }}><X size={13} /></button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <Dumbbell size={18} color={STYLES.brass} />
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700 }}>{c.startDate} → {c.endDate}</span>
                    <span style={{ fontSize: 12, color: STYLES.slate }}>{c.targetWorkoutsPerWeek}x/week goal · Week {currentWeek + 1} of {weeks}</span>
                    {!isActive && <span style={{ fontSize: 11, color: STYLES.slate, background: STYLES.ink + "0d", padding: "2px 8px", borderRadius: 10 }}>{today < c.startDate ? "Upcoming" : "Ended"}</span>}
                    <button onClick={() => startEditChallenge(c)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate }}><Pencil size={15} /></button>
                  </div>
                )}

                <div className={users.length > 1 ? "gym-participants" : ""} style={users.length > 1 ? undefined : { display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                  {users.map((u) => (
                    <ParticipantPanel key={u} challenge={c} user={u} weeks={weeks} currentWeek={currentWeek} onPatch={(patch) => patchParticipant(c, u, patch)} onLogWeighIn={(weekIdx, weight) => logWeighIn(c, u, weekIdx, weight)} onToggleWorkout={(dateStr) => toggleWorkoutDate(c, u, dateStr)} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>
    </>
  );
}

function ParticipantPanel({ challenge, user, weeks, currentWeek, onPatch, onLogWeighIn, onToggleWorkout }) {
  const p = challenge.participants[user] || emptyParticipant();
  const [startInput, setStartInput] = useState(p.startingWeight ?? "");
  const [targetInput, setTargetInput] = useState(p.targetWeight ?? "");
  const [weighInput, setWeighInput] = useState("");

  const target = targetForWeek(p, weeks, currentWeek);
  const currentWeighIn = p.weighIns.find((w) => w.week === currentWeek);

  // Days of the current week, clipped to the challenge range.
  const weekStart = new Date(challenge.startDate + "T00:00:00");
  weekStart.setDate(weekStart.getDate() + currentWeek * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    if (dStr >= challenge.startDate && dStr <= challenge.endDate) days.push(dStr);
  }
  const workoutsThisWeek = days.filter((d) => p.workoutDates.includes(d)).length;
  const weekOver = todayStr() > days[days.length - 1];
  const workoutColor = workoutsThisWeek >= challenge.targetWorkoutsPerWeek ? STYLES.green : weekOver ? STYLES.wax : STYLES.slate;

  return (
    <div style={{ border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontFamily: "Georgia, serif" }}>{user}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: STYLES.slate, flex: 1 }}>
          Starting weight
          <input type="number" value={startInput} onChange={(e) => setStartInput(e.target.value)} onBlur={() => onPatch({ startingWeight: startInput === "" ? null : Number(startInput) })} style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", marginTop: 3 }} />
        </label>
        <label style={{ fontSize: 12, color: STYLES.slate, flex: 1 }}>
          Target weight
          <input type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} onBlur={() => onPatch({ targetWeight: targetInput === "" ? null : Number(targetInput) })} style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", marginTop: 3 }} />
        </label>
      </div>

      {target != null && (
        <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>
          Week {currentWeek + 1} target: <strong style={{ color: STYLES.ink }}>{target.toFixed(1)}</strong>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        <input type="number" placeholder={currentWeighIn ? String(currentWeighIn.weight) : "Log this week's weight"} value={weighInput} onChange={(e) => setWeighInput(e.target.value)} style={{ ...selectStyle(), flex: 1 }} />
        <button onClick={() => { if (weighInput !== "") { onLogWeighIn(currentWeek, Number(weighInput)); setWeighInput(""); } }} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Log</button>
      </div>

      {p.weighIns.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {p.weighIns.slice().sort((a, b) => a.week - b.week).map((w) => {
            const t = targetForWeek(p, weeks, w.week);
            const status = weightStatus(t, w.weight, p.startingWeight);
            return (
              <div key={w.week} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[status] }} />
                <span style={{ color: STYLES.slate, minWidth: 50 }}>Week {w.week + 1}</span>
                <span>{w.weight}{t != null ? ` (target ${t.toFixed(1)})` : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 4 }}>
        This week's workouts — <span style={{ color: workoutColor, fontWeight: 700 }}>{workoutsThisWeek}/{challenge.targetWorkoutsPerWeek}</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {days.map((d) => {
          const checked = p.workoutDates.includes(d);
          const dayLabel = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
          return (
            <button key={d} onClick={() => onToggleWorkout(d)} title={d} style={{ width: 34, height: 34, borderRadius: 4, border: `1px solid ${checked ? STYLES.green : STYLES.ink + "33"}`, background: checked ? STYLES.green : "#fff", color: checked ? "#fff" : STYLES.slate, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 9, lineHeight: 1 }}>
              <span>{dayLabel[0]}</span>
              {checked && <Check size={11} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
