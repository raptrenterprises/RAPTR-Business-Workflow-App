import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || "",
    category: r.category || "Other",
    date: r.event_date,
    endDate: r.end_date || r.event_date,
    time: r.event_time,
    allDay: r.all_day,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function fetchEvents() {
  const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: true });
  if (error) throw error;
  return data.map(fromRow);
}

export async function insertEvent(ev) {
  const { error } = await supabase.from("events").insert({
    id: ev.id,
    title: ev.title,
    description: ev.description || null,
    category: ev.category || "Other",
    event_date: ev.date,
    end_date: ev.endDate || ev.date,
    event_time: ev.allDay ? null : ev.time || null,
    all_day: ev.allDay,
    created_by: ev.createdBy,
    created_at: ev.createdAt,
  });
  if (error) throw error;
}

export async function updateEvent(id, patch) {
  const dbPatch = {};
  if ("title" in patch) dbPatch.title = patch.title;
  if ("description" in patch) dbPatch.description = patch.description;
  if ("category" in patch) dbPatch.category = patch.category;
  if ("date" in patch) dbPatch.event_date = patch.date;
  if ("endDate" in patch) dbPatch.end_date = patch.endDate;
  if ("time" in patch) dbPatch.event_time = patch.time;
  if ("allDay" in patch) dbPatch.all_day = patch.allDay;
  const { error } = await supabase.from("events").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteEventRow(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeEvents(onChange) {
  const channel = supabase
    .channel("events-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
