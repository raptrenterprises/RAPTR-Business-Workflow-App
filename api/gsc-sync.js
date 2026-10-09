// Vercel Serverless Function: pulls Google Search Console data into Supabase.
//
// Runs two ways:
//  - every morning, from the cron job in vercel.json (Vercel sends "Authorization: Bearer <CRON_SECRET>")
//  - when someone presses "Sync now" in the app (POST, signed in with their normal app login)
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//  GSC_SERVICE_ACCOUNT_JSON   the whole contents of the Google service account's key file
//  GSC_SITE_URL               the Search Console property, e.g. sc-domain:raptrmysteries.com
//  SUPABASE_SERVICE_ROLE_KEY  Supabase > Project Settings > API > service_role key (keep it secret)
//  CRON_SECRET                any long random string; Vercel sends it with the daily cron call
// The Supabase address comes from VITE_SUPABASE_URL, which the app already has.

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { googleAccessToken, fetchSearchAnalytics, keywordsByPost, daysAgo, isoDay } from "./_gscLib.js";

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function setStatus(db, status, message, details = {}) {
  await db.from("integration_status").upsert({ key: "gsc", last_synced_at: new Date().toISOString(), last_status: status, last_message: message, details });
}

async function pageAll(build) {
  const rows = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Replaces each blog post's Search Console keywords with the latest top 25 (last 30 days).
async function updatePostKeywords(db) {
  const { data: posts, error } = await db.from("posts").select("id, live_url").eq("post_type", "Blog post").not("live_url", "is", null).neq("live_url", "");
  if (error) throw error;
  const { data: latest } = await db.from("gsc_search_daily").select("date").order("date", { ascending: false }).limit(1);
  const latestDate = latest?.[0]?.date;
  const linkedIds = posts.map((p) => p.id);

  // Posts whose address was removed no longer have synced keywords.
  const staleQuery = db.from("post_keywords").delete().eq("source", "gsc");
  if (linkedIds.length > 0) await staleQuery.not("post_id", "in", `(${linkedIds.join(",")})`);
  else await staleQuery;
  if (!latestDate || posts.length === 0) return { posts: 0, keywords: 0 };

  const since = isoDay(new Date(new Date(latestDate).getTime() - 29 * 86400000));
  const rows = await pageAll(() => db.from("gsc_search_daily").select("query, page, clicks, impressions, position").gte("date", since).order("date").order("query").order("page"));
  const byPost = keywordsByPost(posts, rows, 25);

  let keywords = 0;
  for (const post of posts) {
    const fresh = byPost.get(post.id) || [];
    const { data: existing, error: e2 } = await db.from("post_keywords").select("id, keyword, source").eq("post_id", post.id);
    if (e2) throw e2;
    const freshKeys = new Set(fresh.map((k) => k.keyword.toLowerCase()));
    // Old synced rows go, and so do hand-typed rows for a keyword the sync now reports (its numbers replace them).
    const drop = existing.filter((r) => r.source === "gsc" || freshKeys.has(r.keyword.toLowerCase())).map((r) => r.id);
    if (drop.length > 0) { const { error: e3 } = await db.from("post_keywords").delete().in("id", drop); if (e3) throw e3; }
    if (fresh.length > 0) {
      const { error: e4 } = await db.from("post_keywords").insert(fresh.map((k) => ({ post_id: post.id, keyword: k.keyword, impressions: k.impressions, clicks: k.clicks, ctr: k.ctr, avg_position: k.avg_position, period_days: 30, source: "gsc", updated_at: new Date().toISOString() })));
      if (e4) throw e4;
      keywords += fresh.length;
    }
  }
  return { posts: posts.length, keywords };
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) { res.status(500).json({ error: "Not set up yet: SUPABASE_SERVICE_ROLE_KEY is missing in Vercel." }); return; }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Who is asking: the daily cron (secret) or someone signed in to the app.
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const isCron = !!process.env.CRON_SECRET && !!token && sameSecret(token, process.env.CRON_SECRET);
  if (!isCron) {
    const { data, error } = token ? await db.auth.getUser(token) : { error: true };
    if (error || !data?.user) { res.status(401).json({ error: "Please sign in again, then retry." }); return; }
  }

  const saJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE_URL;
  if (!saJson || !site) { res.status(500).json({ error: "Not set up yet: GSC_SERVICE_ACCOUNT_JSON and GSC_SITE_URL must both be added in Vercel." }); return; }

  try {
    let sa;
    try { sa = JSON.parse(saJson); } catch (_) { throw new Error("GSC_SERVICE_ACCOUNT_JSON isn't valid JSON. Paste the whole key file's contents."); }
    if (!sa.client_email || !sa.private_key) throw new Error("GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");

    // First run (empty table) pulls 90 days; after that the last 14 days are refreshed, since Search Console revises recent days.
    const { count } = await db.from("gsc_search_daily").select("date", { count: "exact", head: true });
    const asked = Number(req.body?.backfillDays || req.query?.backfillDays || 0);
    const days = asked > 0 ? Math.min(asked, 480) : count ? 14 : 90;
    const startDate = daysAgo(days);
    const endDate = daysAgo(1);

    const token2 = await googleAccessToken(sa);
    const rows = await fetchSearchAnalytics(token2, site, startDate, endDate);
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await db.from("gsc_search_daily").upsert(rows.slice(i, i + 1000), { onConflict: "date,query,page" });
      if (error) throw error;
    }
    const linked = await updatePostKeywords(db);
    const message = `Pulled ${rows.length.toLocaleString("en-US")} rows (${startDate} to ${endDate}); refreshed ${linked.keywords} keywords on ${linked.posts} blog ${linked.posts === 1 ? "post" : "posts"}.`;
    await setStatus(db, "ok", message, { startDate, endDate, rows: rows.length, ...linked, site, sa_email: sa.client_email });
    res.status(200).json({ ok: true, message });
  } catch (err) {
    const message = String(err.message || err);
    try { await setStatus(db, "error", message); } catch (_) { /* status is best effort */ }
    res.status(502).json({ error: message });
  }
}
