// Shared logic for the RAPTRMeet feature — kept out of the components so
// TasksSection and the RAPTRMeet Tasks tab can both use the exact same rules.

// The soonest other upcoming RAPTRMeet, chronologically after this one.
// Falls back to the soonest upcoming meet at all (excluding itself) if
// none start later, and returns null if there's nowhere to roll tasks to.
export function nextRaptrMeet(meets, currentMeetId) {
  const current = meets.find((m) => m.id === currentMeetId);
  const others = meets.filter((m) => m.id !== currentMeetId && m.status !== "completed");
  if (others.length === 0) return null;
  const after = current ? others.filter((m) => m.startDate > current.startDate) : others;
  const pool = after.length > 0 ? after : others;
  return pool.slice().sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] || null;
}

// Marks a RAPTRMeet completed and rolls forward its unchecked tasks:
//   - raptrmeetOnly tasks -> reassigned to the next upcoming RAPTRMeet
//     (left assigned to this one, unassigned in-app, if there isn't one yet —
//     the caller should surface that so it can be assigned manually later)
//   - everything else -> unassigned from this RAPTRMeet (falls back to
//     just being a normal task on the main Tasks list)
// Returns { movedCount, clearedCount, next } for the caller to show a summary.
export async function completeRaptrMeet(meet, allMeets, tasks, { updateTask, updateRaptrMeet }) {
  const openTasks = tasks.filter((t) => t.raptrmeetId === meet.id && !t.completed);
  const next = nextRaptrMeet(allMeets, meet.id);
  let movedCount = 0;
  let clearedCount = 0;
  for (const t of openTasks) {
    if (t.raptrmeetOnly) {
      await updateTask(t.id, { raptrmeetId: next ? next.id : null, raptrmeetDay: null, raptrmeetTimeblock: null });
      movedCount++;
    } else {
      await updateTask(t.id, { raptrmeetId: null, raptrmeetDay: null, raptrmeetTimeblock: null });
      clearedCount++;
    }
  }
  await updateRaptrMeet(meet.id, { status: "completed" });
  return { movedCount, clearedCount, next };
}
