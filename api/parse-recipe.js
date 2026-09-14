// Vercel Serverless Function — runs server-side, so it can fetch other
// sites' pages without hitting browser CORS restrictions.
//
// Most recipe sites embed a schema.org "Recipe" block (JSON-LD) in their
// page HTML so Google can show ratings/cook-time in search results. That
// block already has structured ingredients/instructions/title — this just
// reads it. No API key, no third-party service, no cost.
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

  try {
    const pageResp = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RAPTROpsRecipeImport/1.0; +https://raptrmysteries.com)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    if (!pageResp.ok) {
      res.status(502).json({ error: `That page returned an error (HTTP ${pageResp.status}).` });
      return;
    }
    const html = await pageResp.text();
    const recipe = extractRecipeFromHtml(html);
    if (!recipe) {
      res.status(422).json({ error: "Couldn't find recipe data on that page — try pasting the ingredients instead." });
      return;
    }
    res.status(200).json({ ...recipe, sourceUrl: target.toString() });
  } catch (e) {
    res.status(500).json({ error: "Couldn't read that page: " + (e && e.message ? e.message : "unknown error") });
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
