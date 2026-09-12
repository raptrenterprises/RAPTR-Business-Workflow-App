import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
    location: r.location || "",
    address: r.address || "",
    status: r.status || "upcoming",
    travel: r.travel || {},
    meals: r.meals || [],
    groceryItems: r.grocery_items || [],
    notes: r.notes || "",
    attachments: r.attachments || [],
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function fetchRaptrMeets() {
  const { data, error } = await supabase.from("raptrmeets").select("*").order("start_date", { ascending: true });
  if (error) throw error;
  return data.map(fromRow);
}

export async function insertRaptrMeet(rm) {
  const { error } = await supabase.from("raptrmeets").insert({
    id: rm.id,
    title: rm.title,
    start_date: rm.startDate,
    end_date: rm.endDate,
    location: rm.location || null,
    address: rm.address || null,
    status: rm.status || "upcoming",
    travel: rm.travel || {},
    meals: rm.meals || [],
    grocery_items: rm.groceryItems || [],
    notes: rm.notes || null,
    attachments: rm.attachments || [],
    created_by: rm.createdBy,
    created_at: rm.createdAt,
  });
  if (error) throw error;
}

export async function updateRaptrMeet(id, patch) {
  const dbPatch = {};
  if ("title" in patch) dbPatch.title = patch.title;
  if ("startDate" in patch) dbPatch.start_date = patch.startDate;
  if ("endDate" in patch) dbPatch.end_date = patch.endDate;
  if ("location" in patch) dbPatch.location = patch.location;
  if ("address" in patch) dbPatch.address = patch.address;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("travel" in patch) dbPatch.travel = patch.travel;
  if ("meals" in patch) dbPatch.meals = patch.meals;
  if ("groceryItems" in patch) dbPatch.grocery_items = patch.groceryItems;
  if ("notes" in patch) dbPatch.notes = patch.notes;
  if ("attachments" in patch) dbPatch.attachments = patch.attachments;
  const { error } = await supabase.from("raptrmeets").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteRaptrMeetRow(id) {
  const { error } = await supabase.from("raptrmeets").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeRaptrMeets(onChange) {
  const channel = supabase
    .channel(`raptrmeets-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "raptrmeets" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
