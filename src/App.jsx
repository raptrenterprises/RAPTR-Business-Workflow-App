import { useState, useEffect, lazy, Suspense } from "react";
import { User, ClipboardList, MessageSquare, CalendarDays, Dumbbell, LayoutDashboard } from "lucide-react";
import { STYLES, USERS, USER_DIRECTORY } from "./constants";
import { supabase } from "./lib/supabaseClient";
import Login from "./Login";
import ProfileMenu from "./components/ProfileMenu";
import { SectionButton, CenterMsg } from "./components/Shared";
import { useNavIndicators } from "./hooks/useNavIndicators";
import { useLiveEventIndicator } from "./hooks/useLiveEventIndicator";
import { setAppBadge, clearAppBadge } from "./lib/appBadge";
import DashboardSection from "./sections/DashboardSection";
import TasksSection from "./sections/TasksSection";
import ThreadsSection from "./sections/ThreadsSection";
import CalendarSection from "./sections/CalendarSection";
const GymSection = lazy(() => import("./sections/GymSection"));

export default function RaptrApp() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [section, setSection] = useState("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const currentUser = session
    ? session.user.user_metadata?.display_name || USER_DIRECTORY[session.user.email] || session.user.email
    : null;

  const { hasUnseenThread, hasUrgentTask, unseenThreadCount, urgentTaskCount } = useNavIndicators(currentUser);
  const hasEventNow = useLiveEventIndicator();

  // App icon badge — reflects the same thing as the red nav dots, plus
  // whether a calendar event is currently in progress. Only updates while
  // the app is open (or recently open in the background); it can't wake
  // the app up from fully closed without push notifications.
  useEffect(() => {
    if (!currentUser) { clearAppBadge(); return; }
    setAppBadge(unseenThreadCount + urgentTaskCount + (hasEventNow ? 1 : 0));
  }, [currentUser, unseenThreadCount, urgentTaskCount, hasEventNow]);

  useEffect(() => {
    return () => clearAppBadge();
  }, []);

  if (session === undefined) return <CenterMsg>Loading…</CenterMsg>;
  if (!session) return <Login />;

  return (
    <div style={{ minHeight: "100vh", background: STYLES.parchment, fontFamily: "system-ui, -apple-system, sans-serif", color: STYLES.ink }}>
      <header style={{ background: STYLES.wax, color: STYLES.parchment, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setProfileOpen((o) => !o)} aria-label="Profile" style={{ background: "transparent", border: `1px solid ${STYLES.brass}`, color: STYLES.parchment, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <User size={16} />
            </button>
            {profileOpen && (
              <ProfileMenu currentUser={currentUser} email={session.user.email} onClose={() => setProfileOpen(false)} align="left" />
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: STYLES.brass, textTransform: "uppercase", fontFamily: "Georgia, serif" }}>RAPTR Mysteries</div>
            <div style={{ fontSize: 20, fontFamily: "Georgia, serif" }}>{currentUser}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SectionButton active={section === "dashboard"} onClick={() => setSection("dashboard")} icon={<LayoutDashboard size={15} />} label="Dashboard" />
          <SectionButton active={section === "threads"} onClick={() => setSection("threads")} icon={<MessageSquare size={15} />} label="Threads" showDot={hasUnseenThread} />
          <SectionButton active={section === "tasks"} onClick={() => setSection("tasks")} icon={<ClipboardList size={15} />} label="Tasks" showDot={hasUrgentTask} />
          <SectionButton active={section === "calendar"} onClick={() => setSection("calendar")} icon={<CalendarDays size={15} />} label="Calendar" showDot={hasEventNow} />
          <SectionButton active={section === "gym"} onClick={() => setSection("gym")} icon={<Dumbbell size={15} />} label="Gym" />
        </div>
      </header>

      {section === "dashboard" && <DashboardSection currentUser={currentUser} users={USERS} onNavigate={setSection} />}
      {section === "tasks" && <TasksSection currentUser={currentUser} users={USERS} />}
      {section === "threads" && <ThreadsSection currentUser={currentUser} users={USERS} />}
      {section === "calendar" && <CalendarSection currentUser={currentUser} users={USERS} />}
      {section === "gym" && (
        <Suspense fallback={<CenterMsg>Loading RAPTR Gym…</CenterMsg>}>
          <GymSection currentUser={currentUser} users={USERS} />
        </Suspense>
      )}
    </div>
  );
}
