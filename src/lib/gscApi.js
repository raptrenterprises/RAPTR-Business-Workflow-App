// Google Search Console data, as stored in Supabase by the /api/gsc-sync function.
import { supabase } from "./supabaseClient";

// "https://www.Example.com/blog/My-Post/?utm=1" -> "example.com/blog/my-post" (so a blog post's address matches Search Console's).
// Keep in step with normalizeUrl in api/_gscLib.js.
export function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${path}`;
  } catch (_) {
    return "";
  }
}

// "https://www.example.com/blog/my-post/" -> "/blog/my-post" for compact display.
export function shortPath(u) {
  try { const url = new URL(u); return url.pathname === "/" ? url.hostname : decodeURIComponent(url.pathname).replace(/\/+$/, ""); } catch (_) { return String(u); }
}

export async function fetchGscStatus() {
  const { data, error } = await supabase.from("integration_status").select("*").eq("key", "gsc").maybeSingle();
  if (error) throw error;
  return data ? { lastSyncedAt: data.last_synced_at, status: data.last_status, message: data.last_message || "", details: data.details || {} } : null;
}

// Totals for the last `days` days and the same number of days before that.
export async function fetchGscTotals(days) {
  const { data, error } = await supabase.rpc("gsc_totals", { p_days: days });
  if (error) throw error;
  const pick = (period) => {
    const r = (data || []).find((x) => x.period === period);
    return r ? { clicks: Number(r.clicks), impressions: Number(r.impressions), position: r.avg_position === null ? null : Number(r.avg_position) } : null;
  };
  return { current: pick("current"), previous: pick("previous") };
}

export async function fetchGscKeywords(days) {
  const { data, error } = await supabase.rpc("gsc_keywords", { p_days: days });
  if (error) throw error;
  return (data || []).map((r) => ({ query: r.query, clicks: Number(r.clicks), impressions: Number(r.impressions), position: r.avg_position === null ? null : Number(r.avg_position), topPage: r.top_page }));
}

export async function fetchGscPages(days) {
  const { data, error } = await supabase.rpc("gsc_pages", { p_days: days });
  if (error) throw error;
  return (data || []).map((r) => ({ page: r.page, clicks: Number(r.clicks), impressions: Number(r.impressions), position: r.avg_position === null ? null : Number(r.avg_position), topQuery: r.top_query }));
}

// Asks the server to pull the latest numbers from Google now. Resolves { ok, message }.
export async function runGscSync() {
  const { data } = await supabase.auth.getSession();
  let res;
  try {
    res = await fetch("/api/gsc-sync", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` }, body: "{}" });
  } catch (_) {
    throw new Error("Couldn't reach the sync function. Check your connection and try again.");
  }
  let body = {};
  try { body = JSON.parse(await res.text()); } catch (_) { /* not JSON */ }
  if (!res.ok) throw new Error(body.error || (res.status === 404 ? "The sync function isn't available here. It only runs once the app is deployed on Vercel." : `Sync failed (HTTP ${res.status}).`));
  return body;
}
