import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    participants: r.participants,
    createdBy: r.created_by,
    createdAt: r.created_at,
    importance: r.importance,
    urgency: r.urgency,
    status: r.status,
    turn: r.turn,
    seenBy: r.seen_by || [],
    completedAt: r.completed_at,
    dueDate: r.due_date,
    messages: r.messages || [],
  };
}

export async function fetchThreads() {
  const { data, error } = await supabase.from("threads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function insertThread(thread) {
  const { error } = await supabase.from("threads").insert({
    id: thread.id,
    title: thread.title,
    participants: thread.participants,
    created_by: thread.createdBy,
    created_at: thread.createdAt,
    importance: thread.importance,
    urgency: thread.urgency,
    status: thread.status,
    turn: thread.turn,
    seen_by: thread.seenBy,
    completed_at: thread.completedAt,
    due_date: thread.dueDate || null,
    messages: thread.messages,
  });
  if (error) throw error;
}

export async function updateThread(id, patch) {
  const dbPatch = {};
  if ("title" in patch) dbPatch.title = patch.title;
  if ("importance" in patch) dbPatch.importance = patch.importance;
  if ("urgency" in patch) dbPatch.urgency = patch.urgency;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("turn" in patch) dbPatch.turn = patch.turn;
  if ("seenBy" in patch) dbPatch.seen_by = patch.seenBy;
  if ("completedAt" in patch) dbPatch.completed_at = patch.completedAt;
  if ("dueDate" in patch) dbPatch.due_date = patch.dueDate;
  if ("messages" in patch) dbPatch.messages = patch.messages;
  const { error } = await supabase.from("threads").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteThreadRow(id) {
  const { error } = await supabase.from("threads").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeThreads(onChange) {
  const channel = supabase.channel("threads-changes").on("postgres_changes", { event: "*", schema: "public", table: "threads" }, onChange).subscribe();
  return () => supabase.removeChannel(channel);
}
