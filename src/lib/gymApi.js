import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    targetWorkoutsPerWeek: r.target_workouts_per_week,
    createdBy: r.created_by,
    createdAt: r.created_at,
    participants: r.participants || {},
  };
}

export async function fetchChallenges() {
  const { data, error } = await supabase.from("gym_challenges").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function insertChallenge(c) {
  const { error } = await supabase.from("gym_challenges").insert({
    id: c.id,
    start_date: c.startDate,
    end_date: c.endDate,
    target_workouts_per_week: c.targetWorkoutsPerWeek,
    created_by: c.createdBy,
    created_at: c.createdAt,
    participants: c.participants,
  });
  if (error) throw error;
}

export async function updateChallenge(id, patch) {
  const dbPatch = {};
  if ("startDate" in patch) dbPatch.start_date = patch.startDate;
  if ("endDate" in patch) dbPatch.end_date = patch.endDate;
  if ("targetWorkoutsPerWeek" in patch) dbPatch.target_workouts_per_week = patch.targetWorkoutsPerWeek;
  if ("participants" in patch) dbPatch.participants = patch.participants;
  const { error } = await supabase.from("gym_challenges").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteChallengeRow(id) {
  const { error } = await supabase.from("gym_challenges").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeChallenges(onChange) {
  const channel = supabase
    .channel(`gym-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "gym_challenges" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
