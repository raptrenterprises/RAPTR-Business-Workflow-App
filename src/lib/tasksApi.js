import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    owner: r.owner,
    completed: r.completed,
    createdBy: r.created_by,
    createdAt: r.created_at,
    importance: r.importance,
    urgency: r.urgency,
    dueDate: r.due_date,
    recurrence: r.recurrence,
  };
}

export async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function insertTask(task) {
  const { error } = await supabase.from("tasks").insert({
    id: task.id,
    title: task.title,
    owner: task.owner,
    completed: task.completed,
    created_by: task.createdBy,
    created_at: task.createdAt,
    importance: task.importance,
    urgency: task.urgency,
    due_date: task.dueDate,
    recurrence: task.recurrence,
  });
  if (error) throw error;
}

export async function updateTask(id, patch) {
  const dbPatch = {};
  if ("title" in patch) dbPatch.title = patch.title;
  if ("owner" in patch) dbPatch.owner = patch.owner;
  if ("completed" in patch) dbPatch.completed = patch.completed;
  if ("importance" in patch) dbPatch.importance = patch.importance;
  if ("urgency" in patch) dbPatch.urgency = patch.urgency;
  if ("dueDate" in patch) dbPatch.due_date = patch.dueDate;
  if ("recurrence" in patch) dbPatch.recurrence = patch.recurrence;
  const { error } = await supabase.from("tasks").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRow(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeTasks(onChange) {
  const channel = supabase
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
