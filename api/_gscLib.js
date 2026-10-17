// Helpers for the Search Console sync (api/gsc-sync.js). The leading underscore keeps Vercel
// from exposing this file as its own endpoint.
import crypto from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const b64url = (v) => Buffer.from(v).toString("base64url");

// A short-lived Google access token for the service account (signed locally, no extra packages).
export async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const key = String(sa.private_key || "").replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${signature}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google sign-in failed: ${j.error_description || j.error || r.status}`);
  return j.access_token;
}

// Every day + keyword + page row between two dates (YYYY-MM-DD), paging through Search Console's 25,000-row limit.
export async function fetchSearchAnalytics(token, site, startDate, endDate) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const out = [];
  const limit = 25000;
  for (let startRow = 0; startRow < 500000; startRow += limit) {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date", "query", "page"], rowLimit: limit, startRow }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j.error?.message || `HTTP ${r.status}`;
      if (r.status === 403) throw new Error(`Search Console refused access to "${site}". Add the service account's email as a user on that property in Search Console. (${msg})`);
      if (r.status === 404) throw new Error(`Search Console doesn't know the site "${site}". Check GSC_SITE_URL matches the property exactly (a domain property looks like sc-domain:example.com). (${msg})`);
      throw new Error(`Search Console error: ${msg}`);
    }
    const rows = j.rows || [];
    rows.forEach((row) => out.push({ date: row.keys[0], query: row.keys[1], page: row.keys[2], clicks: row.clicks || 0, impressions: row.impressions || 0, position: row.position ?? null }));
    if (rows.length < limit) break;
  }
  return out;
}

// "https://www.Example.com/blog/My-Post/?utm=1#x" -> "example.com/blog/my-post" so addresses can be compared.
export function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${path}`;
  } catch (_) {
    return "";
  }
}

// How Squarespace turns a title into the end of a blog address: "Destination & Chateau Weddings!" -> "destination-amp-chteau-weddings".
// Used only to line up a Search Console page with the blog post it belongs to.
export function slugKey(text) {
  return String(text || "").toLowerCase().replace(/&/g, " amp ").replace(/[-\u2013\u2014_/]+/g, " ").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim().replace(/ /g, "-");
}

// "https://x.com/blog/some-post/" -> "some-post"; anything that isn't a single blog post address -> "".
export function pageSlug(url) {
  try {
    const parts = new URL(String(url).trim()).pathname.split("/").filter(Boolean);
    return parts.length === 2 && parts[0].toLowerCase() === "blog" ? decodeURIComponent(parts[1]).toLowerCase() : "";
  } catch (_) {
    return "";
  }
}

// Lines up blog posts that have no published address yet with Search Console pages nobody has claimed.
//   posts: [{ id, title, seo_title, status }]   pageUrls: [address]   ->  [{ postId, url }]
// A page matches when its ending equals the post's title (or SEO title) the way Squarespace writes it. Failing that, a
// LIVE post can still match a page whose words overlap strongly, but only when one page is clearly the best fit.
export function matchPagesToPosts(posts, pageUrls) {
  const pages = pageUrls.map((url) => ({ url, slug: pageSlug(url) })).filter((p) => p.slug);
  const taken = new Set();
  const matches = [];
  const matched = new Set();
  for (const post of posts) {
    const keys = [slugKey(post.title), slugKey(post.seo_title)].filter(Boolean);
    const hit = pages.find((p) => !taken.has(p.url) && keys.includes(p.slug));
    if (hit) { matches.push({ postId: post.id, url: hit.url }); taken.add(hit.url); matched.add(post.id); }
  }
  for (const post of posts) {
    if (matched.has(post.id) || post.status !== "live") continue;
    const words = new Set(slugKey(post.title).split("-").filter(Boolean));
    if (words.size < 3) continue;
    let best = null; let bestScore = 0; let second = 0;
    for (const p of pages) {
      if (taken.has(p.url)) continue;
      const pw = new Set(p.slug.split("-"));
      let shared = 0;
      words.forEach((w) => { if (pw.has(w)) shared += 1; });
      const score = shared / (words.size + pw.size - shared);
      if (score > bestScore) { second = bestScore; bestScore = score; best = p; } else if (score > second) second = score;
    }
    if (best && bestScore >= 0.75 && bestScore - second >= 0.15) { matches.push({ postId: post.id, url: best.url }); taken.add(best.url); }
  }
  return matches;
}

// For each blog post (with a live address), its top keywords over the given daily rows:
// clicks and impressions summed, position weighted by impressions, click rate in percent.
// posts: [{ id, live_url }]   rows: [{ query, page, clicks, impressions, position }]
export function keywordsByPost(posts, rows, topN = 25) {
  const byUrl = new Map();
  posts.forEach((p) => { const k = normalizeUrl(p.live_url); if (k) byUrl.set(k, p.id); });
  const acc = new Map(); // postId -> query(lowercase) -> { keyword, clicks, impressions, posWeighted }
  rows.forEach((r) => {
    const postId = byUrl.get(normalizeUrl(r.page));
    if (!postId) return;
    if (!acc.has(postId)) acc.set(postId, new Map());
    const m = acc.get(postId);
    const key = r.query.toLowerCase();
    const cur = m.get(key) || { keyword: r.query, clicks: 0, impressions: 0, posWeighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.posWeighted += (r.position || 0) * r.impressions;
    m.set(key, cur);
  });
  const out = new Map();
  posts.forEach((p) => {
    const m = acc.get(p.id) || new Map();
    const list = [...m.values()]
      .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
      .slice(0, topN)
      .map((k) => ({
        keyword: k.keyword,
        clicks: k.clicks,
        impressions: k.impressions,
        ctr: k.impressions > 0 ? Math.round((k.clicks / k.impressions) * 10000) / 100 : null,
        avg_position: k.impressions > 0 ? Math.round((k.posWeighted / k.impressions) * 10) / 10 : null,
      }));
    out.set(p.id, list);
  });
  return out;
}

export const isoDay = (d) => d.toISOString().slice(0, 10);
export const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86400000));
