// Vercel Serverless Function — runs server-side, so it can fetch other
// sites' pages without hitting browser CORS restrictions.
//
// Most recipe sites embed a schema.org "Recipe" block (JSON-LD) in their
// page HTML so Google can show ratings/cook-time in search results. That
// block already has structured ingredients/instructions/title — this just
// reads it. No API key, no third-party service, no cost.
//
// Some sites block automated requests (bot-protection services often
// fingerprint "no cookies / no JS / datacenter IP" requests and respond
// with an odd status like 401/402/403/429/503, even for pages that have no
// real paywall for a human visitor). When that happens, this falls back to
// the Wayback Machine's archived copy, which is rarely blocked. If both
// fail, the RAPTRMeet UI's recipe-clipper bookmarklet is the reliable
// fallback since it runs in the person's own already-authenticated browser.

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.google.com/",
};

export default async function handler(req, res) {
  const url = req.query?.url;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    res.status(400).json({ error: "That doesn't look like a valid URL." });
    return;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    res.status(400).json({ error: "URL must start with http:// or https://" });
    return;
  }

  const direct = await tryFetchAndExtract(target.toString());
  if (direct.recipe) {
    res.status(200).json({ ...direct.recipe, sourceUrl: target.toString() });
    return;
  }

  // Direct fetch failed or found nothing — try an archived copy.
  const archived = await tryWaybackFallback(target.toString());
  if (archived && archived.recipe) {
    res.status(200).json({ ...archived.recipe, sourceUrl: target.toString() });
    return;
  }

  const blocked = direct.status && [401, 402, 403, 429, 503].includes(direct.status);
  if (direct.status && !direct.ok) {
    res.status(502).json({
      error: blocked
        ? `This site blocked automated access (HTTP ${direct.status}). Try the recipe-clipper bookmarklet instead, or paste the ingredients.`
        : `That page returned an error (HTTP ${direct.status}). Try the bookmarklet or paste the ingredients instead.`,
    });
    return;
  }
  if (direct.error) {
    res.status(500).json({ error: "Couldn't reach that page: " + direct.error });
    return;
  }
  res.status(422).json({ error: "Couldn't find recipe data on that page — try the recipe-clipper bookmarklet or paste the ingredients instead." });
}

async function tryFetchAndExtract(url) {
  try {
    const resp = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!resp.ok) return { ok: false, status: resp.status };
    const html = await resp.text();
    const recipe = extractRecipeFromHtml(html);
    return { ok: true, status: resp.status, recipe };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "unknown error" };
  }
}

async function tryWaybackFallback(url) {
  try {
    const availResp = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
    if (!availResp.ok) return null;
    const availData = await availResp.json();
    const snapshotUrl = availData?.archived_snapshots?.closest?.url;
    if (!snapshotUrl) return null;
    return await tryFetchAndExtract(snapshotUrl);
  } catch {
    return null;
  }
}

function extractRecipeFromHtml(html) {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    let data;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue; // some sites emit slightly-broken JSON-LD; just skip it
    }
    const node = findRecipeNode(data);
    if (node) return normalizeRecipeNode(node);
  }
  return null;
}

function findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findRecipeNode(n);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const type = node["@type"];
  const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
  if (isRecipe) return node;
  if (node["@graph"]) return findRecipeNode(node["@graph"]);
  return null;
}

function normalizeRecipeNode(node) {
  const title = typeof node.name === "string" ? node.name : "";
  let ingredientLines = node.recipeIngredient || node.ingredients || [];
  if (!Array.isArray(ingredientLines)) ingredientLines = [ingredientLines];
  ingredientLines = ingredientLines.filter((x) => typeof x === "string" && x.trim());

  let instructions = "";
  const raw = node.recipeInstructions;
  if (Array.isArray(raw)) {
    instructions = raw
      .map((step) => {
        if (typeof step === "string") return step;
        if (step && typeof step.text === "string") return step.text;
        if (step && Array.isArray(step.itemListElement)) {
          return step.itemListElement.map((s) => (typeof s === "string" ? s : s?.text || "")).join("\n");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  } else if (typeof raw === "string") {
    instructions = raw;
  }

  return { title, ingredientLines, instructions };
}
