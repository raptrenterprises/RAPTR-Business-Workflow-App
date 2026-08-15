import { useState, useEffect, useCallback } from "react";
import { fetchTasks, subscribeTasks } from "../lib/tasksApi";
import { fetchThreads, subscribeThreads } from "../lib/threadsApi";
import { effectiveUrgency } from "../constants";

// Drives the red nav indicators: unseen threads waiting on you, and
// urgent (Immediate/High) open tasks assigned to you or shared.
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
      const flag = tasks.some(
        (t) => !t.completed && (t.owner === currentUser || t.owner === "shared") && ["Immediate", "High"].includes(effectiveUrgency(t))
      );
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
