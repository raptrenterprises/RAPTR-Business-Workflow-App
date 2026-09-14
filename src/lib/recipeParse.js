// Lightweight "2 cups flour" -> { quantity: "2 cups", name: "flour" } splitter.
// Not perfect (ingredient text in the wild is messy), but good enough as a
// starting point — the UI always lets the person edit/remove lines before
// anything is added to the grocery list.
const UNIT_WORDS = [
  "cups?", "tbsp", "tablespoons?", "tsp", "teaspoons?", "oz", "ounces?", "lbs?", "pounds?",
  "g", "grams?", "kg", "kilograms?", "ml", "l", "liters?", "litres?", "pinch(?:es)?",
  "cloves?", "cans?", "packages?", "pkgs?", "sticks?", "slices?", "bunch(?:es)?",
  "large", "medium", "small", "handful",
];
const QTY_RE = new RegExp(
  `^([\\d¼½¾⅓⅔⅛⅜⅝⅞./\\s-]*\\d[\\d¼½¾⅓⅔⅛⅜⅝⅞./\\s-]*` +
  `(?:\\s*(?:${UNIT_WORDS.join("|")})\\.?)?)\\s+(.+)$`,
  "i"
);

export function parseIngredientLine(raw) {
  const line = (raw || "").replace(/\s+/g, " ").trim();
  if (!line) return null;
  const m = line.match(QTY_RE);
  if (m && m[2]) return { quantity: m[1].trim(), name: m[2].trim() };
  return { quantity: "", name: line };
}

export function parseIngredientsText(text) {
  return (text || "")
    .split("\n")
    // Strip actual list markers ("- ", "* ", "• ", "1. ", "2) ") without
    // eating a real leading quantity like "2 cups flour".
    .map((l) => l.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim())
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter(Boolean);
}
