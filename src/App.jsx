import { useState, useEffect } from "react";
import { LogOut, ClipboardList, MessageSquare, CalendarDays, Dumbbell } from "lucide-react";
import { STYLES, USERS, USER_DIRECTORY } from "./constants";
import { supabase } from "./lib/supabaseClient";
import Login from "./Login";
import { SectionButton, CenterMsg } from "./components/Shared";
import TasksSection from "./sections/TasksSection";
import ThreadsSection from "./sections/ThreadsSection";
import CalendarSection from "./sections/CalendarSection";
import GymSection from "./sections/GymSection";

export default function RaptrApp() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [section, setSection] = useState("tasks");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <CenterMsg>Loading…</CenterMsg>;
  if (!session) return <Login />;

  const currentUser = USER_DIRECTORY[session.user.email] || session.user.email;

  return (
    <div style={{ minHeight: "100vh", background: STYLES.parchment, fontFamily: "system-ui, -apple-system, sans-serif", color: STYLES.ink }}>
      <header style={{ background: STYLES.ink, color: STYLES.parchment, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: STYLES.brass, textTransform: "uppercase", fontFamily: "Georgia, serif" }}>RAPTR Mysteries</div>
          <div style={{ fontSize: 20, fontFamily: "Georgia, serif" }}>{currentUser}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SectionButton active={section === "tasks"} onClick={() => setSection("tasks")} icon={<ClipboardList size={15} />} label="Tasks" />
          <SectionButton active={section === "threads"} onClick={() => setSection("threads")} icon={<MessageSquare size={15} />} label="Threads" />
          <SectionButton active={section === "calendar"} onClick={() => setSection("calendar")} icon={<CalendarDays size={15} />} label="Calendar" />
          <SectionButton active={section === "gym"} onClick={() => setSection("gym")} icon={<Dumbbell size={15} />} label="Gym" />
          <button onClick={() => supabase.auth.signOut()} style={{ background: "transparent", border: `1px solid ${STYLES.brass}`, color: STYLES.parchment, borderRadius: 4, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {section === "tasks" && <TasksSection currentUser={currentUser} users={USERS} />}
      {section === "threads" && <ThreadsSection currentUser={currentUser} users={USERS} />}
      {section === "calendar" && <CalendarSection currentUser={currentUser} users={USERS} />}
      {section === "gym" && <GymSection currentUser={currentUser} users={USERS} />}
    </div>
  );
}
