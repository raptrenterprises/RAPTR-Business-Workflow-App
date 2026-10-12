import { supabase } from "./supabaseClient";

// Everything here goes through the database's rules (migrations 022 and 023):
// you can only ever read your own votes and status, and all writes are checked there.

// ---- Votes and result (private) ----
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

export function subscribePactVotes(onChange) {
  return subscribe("pact_votes", onChange);
}

// ---- Microaggression counters (shared by both of you) ----
export async function fetchCounterCategories() {
  const { data, error } = await supabase.from("pact_counter_categories").select("id, kind, name, created_at").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, kind: r.kind, name: r.name }));
}

export async function addCounterCategory(kind, name) {
  const { error } = await supabase.from("pact_counter_categories").insert({ kind, name: name.trim() });
  if (error) throw error;
}

export async function renameCounterCategory(id, name) {
  const { error } = await supabase.from("pact_counter_categories").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

// Also deletes that category's counts for both of you.
export async function removeCounterCategory(id) {
  const { error } = await supabase.from("pact_counter_categories").delete().eq("id", id);
  if (error) throw error;
}

// Per day, category, person and kind (micro or macro): how many were added. The API returns at most 1000 rows
// per request, so page through.
export async function fetchCounterDaily() {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("pact_counter_daily").select("day, category_id, person, kind, total")
      .order("day", { ascending: true }).order("category_id", { ascending: true }).order("person", { ascending: true }).order("kind", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    data.forEach((r) => out.push({ day: r.day, categoryId: r.category_id, person: r.person, kind: r.kind, total: r.total }));
    if (data.length < PAGE) break;
  }
  return out;
}

// Adds one micro or macro count. You can only add to your own counter.
export async function addCounterEvent(categoryId, person, kind) {
  const { error } = await supabase.rpc("pact_counter_add", { p_category: categoryId, p_person: person, p_kind: kind });
  if (error) throw error;
}

export function subscribeCounters(onChange) {
  const u1 = subscribe("pact_counter_categories", onChange);
  const u2 = subscribe("pact_counter_events", onChange);
  return () => { u1(); u2(); };
}

function subscribe(table, onChange) {
  const channel = supabase
    .channel(`${table}-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
