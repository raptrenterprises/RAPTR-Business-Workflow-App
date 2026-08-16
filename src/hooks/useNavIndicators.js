import { useState, useEffect, useCallback } from "react";
import { fetchTasks, subscribeTasks } from "../lib/tasksApi";
import { fetchThreads, subscribeThreads } from "../lib/threadsApi";
import { effectiveUrgency, todayStr } from "../constants";

// Drives the red nav indicators: unseen threads waiting on you, and
// critical/overdue open tasks that are yours or shared (never the other
// person's individually-owned tasks).
export function useNavIndicators(currentUser) {
  const [hasUnseenThread, setHasUnseenThread] = useState(false);
  const [hasUrgentTask, setHasUrgentTask] = useState(false);

  const recomputeThreads = useCallback(async () => {
    try {
      const threads = await fetchThreads();
      const flag = threads.some((th) => th.status === "active" && th.turn === currentUser && !th.seenBy.includes(currentUser));
      setHasUnseenThread(flag);
    } catch {
      // non-fatal — indicator just won't show if this fails
    }
  }, [currentUser]);

  const recomputeTasks = useCallback(async () => {
    try {
      const tasks = await fetchTasks();
      const flag = tasks.some((t) => {
        if (t.completed) return false;
        const isMineOrShared = t.owner === currentUser || t.owner === "shared";
        if (!isMineOrShared) return false;
        const isOverdue = !!t.dueDate && t.dueDate < todayStr();
        return effectiveUrgency(t) === "Immediate" || isOverdue;
      });
      setHasUrgentTask(flag);
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

  return { hasUnseenThread, hasUrgentTask };
}
