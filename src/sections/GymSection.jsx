import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Plus, Pencil, Save, X, Dumbbell, Trash2 } from "lucide-react";
import { STYLES, uid, todayStr, daysBetween, addDays, selectStyle, TIME_ZONE, WORKOUT_TYPES } from "../constants";
import { CenterMsg, EmptyMsg, ErrorBar } from "../components/Shared";
import { fetchChallenges, insertChallenge, updateChallenge, deleteChallengeRow, subscribeChallenges } from "../lib/gymApi";

function emptyParticipant() {
  return { startingWeight: null, targetWeight: null, weighIns: [], workouts: [] };
}

// Reads a participant's data with backward-compatible fallbacks for the
// older data shapes (weekly weigh-ins keyed by week number, and plain
// boolean workoutDates instead of typed workouts).
function normalizeParticipant(raw, challenge) {
  const p = raw || {};
  let weighIns = p.weighIns || [];
  weighIns = weighIns.map((w) => (w.date ? w : { date: addDays(challenge.startDate, (w.week || 0) * 7), weight: w.weight, at: w.at }));
  let workouts = p.workouts;
  if (!workouts) workouts = (p.workoutDates || []).map((d) => ({ date: d, type: "Other" }));
  return { startingWeight: p.startingWeight ?? null, targetWeight: p.targetWeight ?? null, weighIns, workouts };
}

function weekIndexForDate(startDate, dateStr) {
  return Math.floor(daysBetween(startDate, dateStr) / 7);
}
function totalWeeks(startDate, endDate) {
  return Math.max(1, Math.ceil(daysBetween(startDate, endDate) / 7));
}
function targetForDate(p, challenge, dateStr) {
  if (p.startingWeight == null || p.targetWeight == null) return null;
  const totalDays = Math.max(1, daysBetween(challenge.startDate, challenge.endDate));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(challenge.startDate, dateStr)));
  const frac = elapsed / totalDays;
  return p.startingWeight + (p.targetWeight - p.startingWeight) * frac;
}
function weightStatus(target, actual, startingWeight) {
  if (target == null || actual == null) return "none";
  const losing = startingWeight != null && target < startingWeight;
  const gaining = startingWeight != null && target > startingWeight;
  const diff = actual - target;
  const tol = 1;
  if (losing) { if (diff <= tol) return "good"; if (diff <= tol * 3) return "warn"; return "bad"; }
  if (gaining) { if (diff >= -tol) return "good"; if (diff >= -tol * 3) return "warn"; return "bad"; }
  return Math.abs(diff) <= tol ? "good" : "warn";
}
const STATUS_COLOR = { good: STYLES.green, warn: STYLES.brass, bad: STYLES.wax, none: STYLES.gray };
const PARTICIPANT_COLOR = { Cathy: STYLES.purple, Evan: STYLES.blue };

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
    const weights = {};
    users.forEach((u) => {
      const p = normalizeParticipant(c.participants[u], c);
      weights[u] = { startingWeight: p.startingWeight ?? "", targetWeight: p.targetWeight ?? "" };
    });
    setEditDraft({ startDate: c.startDate, endDate: c.endDate, targetWorkoutsPerWeek: c.targetWorkoutsPerWeek, weights });
  }

  async function saveEditChallenge(id, challenge) {
    try {
      const nextParticipants = { ...challenge.participants };
      users.forEach((u) => {
        const existing = normalizeParticipant(challenge.participants[u], challenge);
        const w = editDraft.weights[u];
        nextParticipants[u] = {
          ...existing,
          startingWeight: w.startingWeight === "" ? null : Number(w.startingWeight),
          targetWeight: w.targetWeight === "" ? null : Number(w.targetWeight),
        };
      });
      await updateChallenge(id, { startDate: editDraft.startDate, endDate: editDraft.endDate, targetWorkoutsPerWeek: Number(editDraft.targetWorkoutsPerWeek) || 1, participants: nextParticipants });
      setEditingId(null); setEditDraft(null); reload();
    } catch (e) { setError("Couldn't save changes: " + e.message); }
  }

  async function deleteChallenge(id) {
    if (!window.confirm("Delete this challenge? This removes all logged weights and workouts for it and can't be undone.")) return;
    try { await deleteChallengeRow(id); reload(); } catch (e) { setError("Couldn't delete challenge: " + e.message); }
  }

  async function patchParticipant(challenge, user, patch) {
    const existing = normalizeParticipant(challenge.participants[user], challenge);
    const nextParticipants = { ...challenge.participants, [user]: { ...existing, ...patch } };
    try { await updateChallenge(challenge.id, { participants: nextParticipants }); reload(); } catch (e) { setError("Couldn't save: " + e.message); }
  }

  async function logWeighIn(challenge, user, dateStr, weight) {
    const p = normalizeParticipant(challenge.participants[user], challenge);
    const others = p.weighIns.filter((w) => w.date !== dateStr);
    const weighIns = [...others, { date: dateStr, weight, at: new Date().toISOString() }].sort((a, b) => a.date.localeCompare(b.date));
    await patchParticipant(challenge, user, { weighIns });
  }

  async function setWorkout(challenge, user, dateStr, type) {
    const p = normalizeParticipant(challenge.participants[user], challenge);
    const others = p.workouts.filter((w) => w.date !== dateStr);
    const workouts = type ? [...others, { date: dateStr, type }] : others;
    await patchParticipant(challenge, user, { workouts });
  }

  if (loading) return <CenterMsg>Loading RAPTR Gym…</CenterMsg>;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px" }}>
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
            <span style={{ fontSize: 12, color: STYLES.slate }}>(starting/target weights are set after creation, via the pencil icon)</span>
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
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
                      <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
                        Start <input type="date" value={editDraft.startDate} onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })} style={selectStyle()} />
                      </label>
                      <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
                        End <input type="date" value={editDraft.endDate} onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })} style={selectStyle()} />
                      </label>
                      <label style={{ fontSize: 13, color: STYLES.slate, display: "flex", alignItems: "center", gap: 6 }}>
                        Workouts/week <input type="number" min={1} max={14} value={editDraft.targetWorkoutsPerWeek} onChange={(e) => setEditDraft({ ...editDraft, targetWorkoutsPerWeek: e.target.value })} style={{ ...selectStyle(), width: 56 }} />
                      </label>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
                      {users.map((u) => (
                        <div key={u} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <strong style={{ fontSize: 13, color: PARTICIPANT_COLOR[u] || STYLES.ink }}>{u}</strong>
                          <label style={{ fontSize: 12, color: STYLES.slate, display: "flex", alignItems: "center", gap: 4 }}>
                            Start wt <input type="number" value={editDraft.weights[u].startingWeight} onChange={(e) => setEditDraft({ ...editDraft, weights: { ...editDraft.weights, [u]: { ...editDraft.weights[u], startingWeight: e.target.value } } })} style={{ ...selectStyle(), width: 64 }} />
                          </label>
                          <label style={{ fontSize: 12, color: STYLES.slate, display: "flex", alignItems: "center", gap: 4 }}>
                            Target wt <input type="number" value={editDraft.weights[u].targetWeight} onChange={(e) => setEditDraft({ ...editDraft, weights: { ...editDraft.weights, [u]: { ...editDraft.weights[u], targetWeight: e.target.value } } })} style={{ ...selectStyle(), width: 64 }} />
                          </label>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveEditChallenge(c.id, c)} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}><Save size={13} /> Save</button>
                      <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: "transparent", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "7px 10px", cursor: "pointer" }}><X size={13} /></button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <Dumbbell size={18} color={STYLES.brass} />
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700 }}>{c.startDate} → {c.endDate}</span>
                    <span style={{ fontSize: 12, color: STYLES.slate }}>{c.targetWorkoutsPerWeek}x/week goal · Week {currentWeek + 1} of {weeks}</span>
                    {!isActive && <span style={{ fontSize: 11, color: STYLES.slate, background: STYLES.ink + "0d", padding: "2px 8px", borderRadius: 10 }}>{today < c.startDate ? "Upcoming" : "Ended"}</span>}
                    {users.map((u) => {
                      const p = normalizeParticipant(c.participants[u], c);
                      return (
                        <span key={u} style={{ fontSize: 12, color: PARTICIPANT_COLOR[u] || STYLES.slate }}>
                          {u}: {p.startingWeight ?? "—"}→{p.targetWeight ?? "—"}
                        </span>
                      );
                    })}
                    <button onClick={() => startEditChallenge(c)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate }}><Pencil size={15} /></button>
                    <button onClick={() => deleteChallenge(c.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.slate }}><Trash2 size={15} /></button>
                  </div>
                )}

                <div className={users.length > 1 ? "gym-participants" : ""} style={users.length > 1 ? undefined : { display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                  {users.map((u) => (
                    <ParticipantPanel key={u} challenge={c} user={u} currentWeek={currentWeek} onLogWeighIn={(dateStr, weight) => logWeighIn(c, u, dateStr, weight)} onSetWorkout={(dateStr, type) => setWorkout(c, u, dateStr, type)} />
                  ))}
                </div>

                <WeightChart challenge={c} users={users} />
              </div>
            );
          })
        )}
      </main>
    </>
  );
}

function ParticipantPanel({ challenge, user, currentWeek, onLogWeighIn, onSetWorkout }) {
  const p = normalizeParticipant(challenge.participants[user], challenge);
  const [weighInput, setWeighInput] = useState("");
  const today = todayStr();
  const target = targetForDate(p, challenge, today);
  const todaysWeighIn = p.weighIns.find((w) => w.date === today);

  const weekStart = addDays(challenge.startDate, currentWeek * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dStr = addDays(weekStart, i);
    if (dStr >= challenge.startDate && dStr <= challenge.endDate) days.push(dStr);
  }
  const workoutsThisWeek = days.filter((d) => p.workouts.some((w) => w.date === d)).length;
  const weekOver = today > days[days.length - 1];
  const workoutColor = workoutsThisWeek >= challenge.targetWorkoutsPerWeek ? STYLES.green : weekOver ? STYLES.wax : STYLES.slate;

  const recentWeighIns = [...p.weighIns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div style={{ border: `1px solid ${PARTICIPANT_COLOR[user] || STYLES.ink}33`, borderRadius: 6, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontFamily: "Georgia, serif", color: PARTICIPANT_COLOR[user] || STYLES.ink }}>{user}</div>

      {target != null && (
        <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>
          Target today: <strong style={{ color: STYLES.ink }}>{target.toFixed(1)}</strong>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        <input type="number" placeholder={todaysWeighIn ? String(todaysWeighIn.weight) : "Log today's weight"} value={weighInput} onChange={(e) => setWeighInput(e.target.value)} style={{ ...selectStyle(), flex: 1 }} />
        <button onClick={() => { if (weighInput !== "") { onLogWeighIn(today, Number(weighInput)); setWeighInput(""); } }} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Log</button>
      </div>

      {recentWeighIns.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {recentWeighIns.map((w) => {
            const t = targetForDate(p, challenge, w.date);
            const status = weightStatus(t, w.weight, p.startingWeight);
            return (
              <div key={w.date} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[status], flexShrink: 0 }} />
                <span style={{ color: STYLES.slate, minWidth: 78 }}>{w.date}</span>
                <span>{w.weight}{t != null ? ` (target ${t.toFixed(1)})` : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 4 }}>
        This week's workouts — <span style={{ color: workoutColor, fontWeight: 700 }}>{workoutsThisWeek}/{challenge.targetWorkoutsPerWeek}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {days.map((d) => {
          const entry = p.workouts.find((w) => w.date === d);
          const dayLabel = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", timeZone: TIME_ZONE });
          return (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: STYLES.slate, width: 30, flexShrink: 0 }}>{dayLabel}</span>
              <select value={entry?.type || ""} onChange={(e) => onSetWorkout(d, e.target.value || null)} style={{ ...selectStyle(), flex: 1, color: entry ? STYLES.green : STYLES.slate, fontWeight: entry ? 600 : 400 }}>
                <option value="">— not logged —</option>
                {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeightChart({ challenge, users }) {
  const dateSet = new Set([challenge.startDate, challenge.endDate]);
  const participants = {};
  users.forEach((u) => {
    const p = normalizeParticipant(challenge.participants[u], challenge);
    participants[u] = p;
    p.weighIns.forEach((w) => dateSet.add(w.date));
  });
  const dates = Array.from(dateSet).sort();
  const data = dates.map((date) => {
    const point = { date };
    users.forEach((u) => {
      const p = participants[u];
      const w = p.weighIns.find((w) => w.date === date);
      if (w) point[`${u}_actual`] = w.weight;
      const t = targetForDate(p, challenge, date);
      if (t != null) point[`${u}_target`] = Math.round(t * 10) / 10;
    });
    return point;
  });

  const hasAnyTargets = users.some((u) => participants[u].startingWeight != null && participants[u].targetWeight != null);
  if (!hasAnyTargets) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: STYLES.ink, fontFamily: "Georgia, serif" }}>Weight vs Target</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={STYLES.ink + "22"} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {users.flatMap((u) => {
            const color = PARTICIPANT_COLOR[u] || STYLES.brass;
            return [
              <Line key={`${u}-actual`} type="monotone" dataKey={`${u}_actual`} name={`${u} actual`} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls />,
              <Line key={`${u}-target`} type="monotone" dataKey={`${u}_target`} name={`${u} target`} stroke={color} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />,
            ];
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
