import { supabase } from "./supabaseClient";

// Everything here goes through the database's rules (migrations/022_pact_private.sql):
// you can only ever read your own votes and status, and all writes are checked there.

export async function fetchMyPactVotes() {
  const { data, error } = await supabase.from("pact_votes").select("month, interest").order("month", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ month: r.month, interest: r.interest }));
}

export async function submitPactVote(interest) {
  const { error } = await supabase.rpc("pact_submit_vote", { p_interest: interest });
  if (error) throw error;
}

// How many people have voted for a month (0, 1 or 2). Never any values.
export async function fetchPactVotesIn(month) {
  const { data, error } = await supabase.rpc("pact_votes_in", { p_month: month });
  if (error) throw error;
  return data || 0;
}

// Result category + estimate for every month where both people have voted. No ratings or scores.
export async function fetchPactHistory() {
  const { data, error } = await supabase.rpc("pact_history");
  if (error) throw error;
  return (data || []).map((r) => ({
    month: r.month_key,
    level: r.level,
    eteStatus: r.ete_status,
    eteDate: r.ete_date, // 'YYYY-MM-DD' or null
    monthsToGo: r.months_to_go == null ? null : Number(r.months_to_go),
  }));
}

export async function fetchMyPactStatuses() {
  const { data, error } = await supabase.from("pact_status_log").select("effective_month, status").order("effective_month", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ effectiveMonth: r.effective_month, status: r.status }));
}

// Returns the month the new status takes effect from.
export async function setPactStatus(status) {
  const { data, error } = await supabase.rpc("pact_set_status", { p_status: status });
  if (error) throw error;
  return data;
}

export async function fetchCounters() {
  const { data, error } = await supabase.from("pact_counters").select("person, count");
  if (error) throw error;
  const out = {};
  data.forEach((r) => { out[r.person] = r.count; });
  return out;
}

export async function bumpCounter(person) {
  const { data, error } = await supabase.rpc("pact_bump_counter", { p_person: person });
  if (error) throw error;
  return data;
}

function subscribe(table, onChange) {
  const channel = supabase
    .channel(`${table}-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
export const subscribePactVotes = (onChange) => subscribe("pact_votes", onChange);
export const subscribeCounters = (onChange) => subscribe("pact_counters", onChange);
