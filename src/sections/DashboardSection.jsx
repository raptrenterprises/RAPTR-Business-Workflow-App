import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { CalendarDays, MessageSquare, ClipboardList, Dumbbell, ChevronRight } from "lucide-react";
import { STYLES, todayStr, effectiveUrgency, comparePriority, importanceColor, urgencyColor, selectStyle, WORKOUT_TYPES } from "../constants";
import { Badge } from "../components/Shared";
import { fetchEvents, subscribeEvents } from "../lib/eventsApi";
import { fetchTasks, subscribeTasks } from "../lib/tasksApi";
import { fetchThreads, subscribeThreads } from "../lib/threadsApi";
import { fetchChallenges, updateChallenge, subscribeChallenges } from "../lib/gymApi";
import { eventCoversDay } from "../constants";
import { normalizeParticipant, targetForDate, weightStatus, STATUS_COLOR } from "../lib/gymHelpers";

const WeightChart = lazy(() => import("../components/WeightChart"));

const MS_DAY = 86400000;


export default function DashboardSection({ currentUser, users, onNavigate }) {
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [threads, setThreads] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  const reloadEvents = useCallback(async () => { try { setEvents(await fetchEvents()); } catch { /* card just shows empty */ } }, []);
  const reloadTasks = useCallback(async () => { try { setTasks(await fetchTasks()); } catch { /* non-fatal */ } }, []);
  const reloadThreads = useCallback(async () => { try { setThreads(await fetchThreads()); } catch { /* non-fatal */ } }, []);
  const reloadChallenges = useCallback(async () => { try { setChallenges(await fetchChallenges()); } catch { /* non-fatal */ } }, []);

  useEffect(() => {
    Promise.all([reloadEvents(), reloadTasks(), reloadThreads(), reloadChallenges()]).finally(() => setLoading(false));
    const u1 = subscribeEvents(reloadEvents);
    const u2 = subscribeTasks(reloadTasks);
    const u3 = subscribeThreads(reloadThreads);
    const u4 = subscribeChallenges(reloadChallenges);
    return () => { u1(); u2(); u3(); u4(); };
  }, [reloadEvents, reloadTasks, reloadThreads, reloadChallenges]);

  const todaysEvents = useMemo(() => events.filter((e) => eventCoversDay(e, todayStr())), [events]);

  const threadItems = useMemo(() => {
    const active = threads.filter((t) => t.status === "active");
    const newForYou = active.filter((t) => t.turn === currentUser && !t.seenBy.includes(currentUser));
    const immediate = active.filter((t) => effectiveUrgency(t) === "Immediate");
    const byId = new Map();
    [...newForYou, ...immediate].forEach((t) => byId.set(t.id, t));
    return Array.from(byId.values()).sort(comparePriority);
  }, [threads, currentUser]);

  const taskItems = useMemo(() => {
    const myOpen = tasks.filter((t) => !t.completed && (t.owner === currentUser || t.owner === "shared"));
    const sorted = [...myOpen].sort(comparePriority);
    const immediates = sorted.filter((t) => effectiveUrgency(t) === "Immediate");
    return immediates.length > 3 ? immediates : sorted.slice(0, 3);
  }, [tasks, currentUser]);

  const activeChallenge = useMemo(() => {
    const today = todayStr();
    return challenges.find((c) => today >= c.startDate && today <= c.endDate) || null;
  }, [challenges]);

  if (loading) {
    return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: STYLES.slate, fontFamily: "Georgia, serif" }}>Loading dashboard…</div>;
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <CalendarCard events={todaysEvents} onNavigate={onNavigate} />
      <ThreadsCard threads={threadItems} currentUser={currentUser} users={users} onNavigate={onNavigate} />
      <TasksCard tasks={taskItems} onNavigate={onNavigate} />
      <GymCard challenge={activeChallenge} currentUser={currentUser} users={users} onNavigate={onNavigate} onReload={reloadChallenges} />
    </main>
  );
}

function CardShell({ icon, title, onNavigate, section, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: STYLES.ink }}>
          {icon} {title}
        </div>
        <button onClick={() => onNavigate(section)} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex", alignItems: "center", gap: 2, fontSize: 12 }}>
          View all <ChevronRight size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ children }) {
  return <div style={{ fontSize: 13, color: STYLES.slate, padding: "8px 0" }}>{children}</div>;
}

function CalendarCard({ events, onNavigate }) {
  return (
    <CardShell icon={<CalendarDays size={18} color={STYLES.wax} />} title="Today" onNavigate={onNavigate} section="calendar">
      {events.length === 0 ? (
        <EmptyRow>No appointments today.</EmptyRow>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {events.map((e) => (
            <div key={e.id} onClick={() => onNavigate("calendar")} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", padding: "6px 8px", borderRadius: 4, background: STYLES.brass + "14" }}>
              <span style={{ flex: 1 }}>{e.title}</span>
              {!e.allDay && e.time && <span style={{ fontSize: 12, color: STYLES.slate }}>{e.time}</span>}
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function ThreadsCard({ threads, currentUser, users, onNavigate }) {
  const other = users.find((u) => u !== currentUser) || "them";
  return (
    <CardShell icon={<MessageSquare size={18} color={STYLES.wax} />} title="Threads" onNavigate={onNavigate} section="threads">
      {threads.length === 0 ? (
        <EmptyRow>Nothing new or urgent.</EmptyRow>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {threads.map((t) => {
            const urg = effectiveUrgency(t);
            const isNew = t.turn === currentUser && !t.seenBy.includes(currentUser);
            return (
              <div key={t.id} onClick={() => onNavigate("threads")} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", padding: "6px 8px", borderRadius: 4, background: STYLES.brass + "14" }}>
                <span style={{ flex: 1 }}>{t.title}</span>
                {isNew && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: STYLES.wax, padding: "2px 6px", borderRadius: 10 }}>NEW</span>}
                <Badge label={urg} color={urgencyColor(urg)} />
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

function TasksCard({ tasks, onNavigate }) {
  return (
    <CardShell icon={<ClipboardList size={18} color={STYLES.wax} />} title="Tasks" onNavigate={onNavigate} section="tasks">
      {tasks.length === 0 ? (
        <EmptyRow>Nothing on your plate right now.</EmptyRow>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map((t) => {
            const urg = effectiveUrgency(t);
            return (
              <div key={t.id} onClick={() => onNavigate("tasks")} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", padding: "6px 8px", borderRadius: 4, background: STYLES.brass + "14" }}>
                <span style={{ flex: 1 }}>{t.title}</span>
                <Badge label={urg} color={urgencyColor(urg)} />
                <Badge label={t.importance} color={importanceColor(t.importance)} />
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

function GymCard({ challenge, currentUser, users, onNavigate, onReload }) {
  const [weighInput, setWeighInput] = useState("");

  if (!challenge) {
    return (
      <CardShell icon={<Dumbbell size={18} color={STYLES.wax} />} title="RAPTR Gym" onNavigate={onNavigate} section="gym">
        <EmptyRow>No active challenge — start one in Gym.</EmptyRow>
      </CardShell>
    );
  }

  const p = normalizeParticipant(challenge.participants[currentUser], challenge);
  const today = todayStr();
  const todaysWeighIn = p.weighIns.find((w) => w.date === today);
  const todaysWorkout = p.workouts.find((w) => w.date === today);
  const target = targetForDate(p, challenge, today);
  const status = todaysWeighIn ? weightStatus(target, todaysWeighIn.weight, p.startingWeight) : "none";

  async function logWeight() {
    if (weighInput === "") return;
    const others = p.weighIns.filter((w) => w.date !== today);
    const nextWeighIns = [...others, { date: today, weight: Number(weighInput), at: new Date().toISOString() }].sort((a, b) => a.date.localeCompare(b.date));
    const nextParticipants = { ...challenge.participants, [currentUser]: { ...p, weighIns: nextWeighIns } };
    await updateChallenge(challenge.id, { participants: nextParticipants });
    setWeighInput("");
    onReload();
  }

  async function setWorkoutType(type) {
    const others = p.workouts.filter((w) => w.date !== today);
    const nextWorkouts = type ? [...others, { date: today, type }] : others;
    const nextParticipants = { ...challenge.participants, [currentUser]: { ...p, workouts: nextWorkouts } };
    await updateChallenge(challenge.id, { participants: nextParticipants });
    onReload();
  }

  return (
    <CardShell icon={<Dumbbell size={18} color={STYLES.wax} />} title="RAPTR Gym" onNavigate={onNavigate} section="gym">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 4 }}>
        {todaysWeighIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[status], flexShrink: 0 }} />
            <span style={{ color: STYLES.slate }}>{today}</span>
            <span>{todaysWeighIn.weight}{target != null ? ` (target ${target.toFixed(1)})` : ""}</span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="number" placeholder="Log today's weight" value={weighInput} onChange={(e) => setWeighInput(e.target.value)} style={{ ...selectStyle(), width: 170 }} />
            <button onClick={logWeight} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Log</button>
          </div>
        )}

        <select value={todaysWorkout?.type || ""} onChange={(e) => setWorkoutType(e.target.value || null)} style={{ ...selectStyle(), color: todaysWorkout ? STYLES.green : STYLES.slate, fontWeight: todaysWorkout ? 600 : 400 }}>
          <option value="">Today's workout — not logged —</option>
          {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <Suspense fallback={<div style={{ fontSize: 12, color: STYLES.slate, marginTop: 14 }}>Loading chart…</div>}>
        <WeightChart challenge={challenge} users={users} />
      </Suspense>
    </CardShell>
  );
}
