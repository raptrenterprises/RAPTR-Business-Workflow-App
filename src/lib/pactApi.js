import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    month: r.month, // 'YYYY-MM'
    ballots: r.ballots || {}, // { [displayName]: { status, interest } }
    submittedBy: r.submitted_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchPactVotes() {
  const { data, error } = await supabase.from("pact_votes").select("*").order("month", { ascending: true });
  if (error) throw error;
  return data.map(fromRow);
}

// One vote per month: saving again for the same month replaces that month's vote.
export async function savePactVote({ month, ballots, submittedBy }) {
  const { error } = await supabase.from("pact_votes").upsert(
    { month, ballots, submitted_by: submittedBy, updated_at: new Date().toISOString() },
    { onConflict: "month" }
  );
  if (error) throw error;
}

export function subscribePactVotes(onChange) {
  const channel = supabase
    .channel(`pact-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "pact_votes" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
