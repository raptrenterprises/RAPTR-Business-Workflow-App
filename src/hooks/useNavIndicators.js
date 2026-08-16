import { useState, useEffect, useCallback } from "react";
import { fetchTasks, subscribeTasks } from "../lib/tasksApi";
import { fetchThreads, subscribeThreads } from "../lib/threadsApi";
import { effectiveUrgency, todayStr } from "../constants";

// Drives the red nav indicators: unseen threads waiting on you, and
// critical/overdue open tasks that are yours or shared (never the other
// person's individually-owned tasks). Tracks counts (not just yes/no) so
// the count can also drive the OS-level app badge.
export function useNavIndicators(currentUser) {
  const [unseenThreadCount, setUnseenThreadCount] = useState(0);
  const [urgentTaskCount, setUrgentTaskCount] = useState(0);

  const recomputeThreads = useCallback(async () => {
    try {
      const threads = await fetchThreads();
      const count = threads.filter((th) => th.status === "active" && th.turn === currentUser && !th.seenBy.includes(currentUser)).length;
      setUnseenThreadCount(count);
    } catch {
      // non-fatal — indicator just won't show if this fails
    }
  }, [currentUser]);

  const recomputeTasks = useCallback(async () => {
    try {
      const tasks = await fetchTasks();
      const count = tasks.filter((t) => {
        if (t.completed) return false;
        const isMineOrShared = t.owner === currentUser || t.owner === "shared";
        if (!isMineOrShared) return false;
        const isOverdue = !!t.dueDate && t.dueDate < todayStr();
        return effectiveUrgency(t) === "Immediate" || isOverdue;
      }).length;
      setUrgentTaskCount(count);
    } catch {
      // non-fatal
    }
  }, [currentUser]);

  useEffect(() => {
    recomputeThreads();
    recomputeTasks();
    const u1 = subscribeThreads(recomputeThreads);
    const u2 = subscribeTasks(recomputeTasks);
    return () => { u1(); u2(); };
  }, [recomputeThreads, recomputeTasks]);

  return {
    hasUnseenThread: unseenThreadCount > 0,
    hasUrgentTask: urgentTaskCount > 0,
    unseenThreadCount,
    urgentTaskCount,
  };
}
