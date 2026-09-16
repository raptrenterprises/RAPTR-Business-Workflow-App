import { parseIngredient } from "parse-ingredient";
import { uid } from "../constants";
import { categorizeIngredient } from "./groceryCategorize";

// ---- quantity <-> display string ----

const FRACTIONS = [
  [1 / 8, "1/8"], [1 / 4, "1/4"], [1 / 3, "1/3"], [3 / 8, "3/8"], [1 / 2, "1/2"],
  [5 / 8, "5/8"], [2 / 3, "2/3"], [3 / 4, "3/4"], [7 / 8, "7/8"],
];
function formatFraction(value) {
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac < 0.02) return String(whole);
  for (const [dec, str] of FRACTIONS) {
    if (Math.abs(frac - dec) < 0.02) return whole > 0 ? `${whole} ${str}` : str;
  }
  return String(Math.round(value * 100) / 100);
}

// Display forms for the unit IDs parse-ingredient normalizes to.
const UNIT_DISPLAY = {
  teaspoon: ["tsp", "tsp"], tablespoon: ["tbsp", "tbsp"], cup: ["cup", "cups"],
  ounce: ["oz", "oz"], pound: ["lb", "lbs"], gram: ["g", "g"], kilogram: ["kg", "kg"],
  milliliter: ["ml", "ml"], liter: ["l", "l"], pinch: ["pinch", "pinches"],
  clove: ["clove", "cloves"], can: ["can", "cans"], package: ["package", "packages"],
  stick: ["stick", "sticks"], slice: ["slice", "slices"], bunch: ["bunch", "bunches"],
  quart: ["quart", "quarts"], pint: ["pint", "pints"], gallon: ["gallon", "gallons"],
  dash: ["dash", "dashes"], sprig: ["sprig", "sprigs"],
  large: ["large", "large"], medium: ["medium", "medium"], small: ["small", "small"],
};

export function formatQuantityUnit(value, unitId) {
  if (value == null) return "";
  const qtyStr = formatFraction(value);
  if (!unitId) return qtyStr;
  const disp = UNIT_DISPLAY[unitId];
  const label = disp ? (value === 1 ? disp[0] : disp[1]) : unitId;
  return `${qtyStr} ${label}`;
}

// ---- splitting "black beans, drained" into name + prep notes ----

function splitNameAndNotes(rawDescription) {
  let text = (rawDescription || "").trim();
  const notesParts = [];
  const leadParen = text.match(/^\(([^)]+)\)\s*/);
  if (leadParen && /\d/.test(leadParen[1])) {
    notesParts.push(leadParen[1]);
    text = text.slice(leadParen[0].length);
  }
  const commaIdx = text.indexOf(",");
  let name = text;
  if (commaIdx !== -1) {
    name = text.slice(0, commaIdx).trim();
    const rest = text.slice(commaIdx + 1).trim();
    if (rest) notesParts.push(rest);
  }
  name = name.replace(/\s*\(([^)]*)\)\s*$/, (m, inner) => { if (inner.trim()) notesParts.push(inner.trim()); return ""; }).trim();
  return { name: name || rawDescription.trim(), notes: notesParts.join(", ") };
}

export function normalizeIngredientName(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// One parsed, review-ready ingredient row. quantityValue/unit are kept
// (not just the display string) so matching duplicate ingredients later is
// possible — losing that split was the root problem with the old parser.
function parsedRowFromLine(raw) {
  const line = (raw || "").trim();
  if (!line) return null;
  const results = parseIngredient(line);
  const r = results && results[0];
  if (!r || r.isGroupHeader) return null; // skip "For the sauce:" style section headers
  const { name, notes } = splitNameAndNotes(r.description);
  const quantityValue = typeof r.quantity === "number" ? r.quantity : null;
  const unit = r.unitOfMeasureID || null;
  return {
    id: uid(),
    name,
    notes,
    quantityValue,
    unit,
    quantity: quantityValue != null ? formatQuantityUnit(quantityValue, unit) : "",
    category: categorizeIngredient(name),
    include: true,
  };
}

export function parseIngredientsFromLines(lines) {
  return (lines || []).map(parsedRowFromLine).filter(Boolean);
}

export function parseIngredientsText(text) {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim())
    .filter(Boolean);
  return parseIngredientsFromLines(lines);
}

// The recipe-clipper bookmarklet copies "RECIPE: <title>\n<ingredient>\n..."
// to the clipboard. Detect and split that off so pasting it auto-fills the
// recipe name instead of treating the title line as an ingredient.
export function splitClipboardTitle(text) {
  const m = (text || "").match(/^RECIPE:\s*(.+?)\r?\n/i);
  if (m) return { title: m[1].trim(), rest: text.slice(m[0].length) };
  return { title: "", rest: text || "" };
}

// ---- grocery list merge ----
// Only merges when name AND unit match exactly (per Cathy's call) — anything
// else is left as its own line, just grouped next to same-name items by the
// caller's sort so they're easy to eyeball and combine by hand.

export function addRecipeIngredientsToGrocery(existingItems, recipeId, recipeTitle, ingredients) {
  let items = existingItems.slice();
  for (const ing of ingredients) {
    const normName = normalizeIngredientName(ing.name);
    if (ing.quantityValue != null && ing.unit) {
      const idx = items.findIndex((g) => g.source === "recipe" && g.unit === ing.unit && normalizeIngredientName(g.name) === normName);
      if (idx !== -1) {
        const existing = items[idx];
        const contributions = [...(existing.contributions || []), { recipeId, recipeTitle, quantityValue: ing.quantityValue }];
        const total = contributions.reduce((s, c) => s + (c.quantityValue || 0), 0);
        items[idx] = { ...existing, contributions, quantity: formatQuantityUnit(total, ing.unit) };
        continue;
      }
    }
    items.push({
      id: uid(),
      name: ing.name,
      quantity: ing.quantity || "",
      category: ing.category || categorizeIngredient(ing.name),
      checked: false,
      source: "recipe",
      unit: ing.unit || null,
      notes: ing.notes || "",
      contributions: [{ recipeId, recipeTitle, quantityValue: ing.quantityValue ?? null }],
    });
  }
  return items;
}

// Removes exactly one recipe's contribution from the grocery list. Items
// that were combined across multiple recipes just have their quantity
// reduced; items solely from this recipe are dropped entirely.
export function removeRecipeFromGrocery(existingItems, recipeId) {
  return existingItems
    .map((g) => {
      if (g.source !== "recipe" || !g.contributions) return g;
      const remaining = g.contributions.filter((c) => c.recipeId !== recipeId);
      if (remaining.length === g.contributions.length) return g;
      if (remaining.length === 0) return null;
      const total = remaining.reduce((s, c) => s + (c.quantityValue || 0), 0);
      return { ...g, contributions: remaining, quantity: g.unit ? formatQuantityUnit(total, g.unit) : g.quantity };
    })
    .filter(Boolean);
}

export function sortGroceryItems(items) {
  return items.slice().sort((a, b) => normalizeIngredientName(a.name).localeCompare(normalizeIngredientName(b.name)));
}
