import { useState } from "react";
import { Plus, Trash2, Check, UtensilsCrossed, ShoppingCart, Link2, ClipboardPaste, ChefHat, X, ExternalLink } from "lucide-react";
import { STYLES, uid, dateRange, MEAL_TYPES, formatET } from "../../constants";
import { parseIngredientsText, parseIngredientLine } from "../../lib/recipeParse";

const smallInput = { padding: "7px 9px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13 };
const smallBtn = (primary) => ({
  background: primary ? STYLES.wax : "transparent", color: primary ? "#fff" : STYLES.slate,
  border: primary ? "none" : `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "6px 11px",
  cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5,
});

// Hoisted to module scope (see TasksSection.jsx notes on why nested
// component functions with inputs cause focus-loss bugs).
function RecipeImporter({ meal, onSave, onRemove }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("url"); // 'url' | 'paste'
  const [urlValue, setUrlValue] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [review, setReview] = useState(null); // { title, sourceUrl, instructions, ingredients: [{id,quantity,name,include}] }

  function resetPanel() {
    setOpen(false); setMode("url"); setUrlValue(""); setPasteTitle(""); setPasteValue("");
    setFetching(false); setFetchError(""); setReview(null);
  }

  async function fetchFromUrl() {
    const url = urlValue.trim();
    if (!url) return;
    setFetching(true); setFetchError("");
    try {
      const resp = await fetch(`/api/parse-recipe?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      if (!resp.ok) { setFetchError(data.error || "Couldn't read that page."); return; }
      if (!data.ingredientLines || data.ingredientLines.length === 0) {
        setFetchError("Found the page but no ingredients on it — try pasting them instead.");
        return;
      }
      setReview({
        title: data.title || "",
        sourceUrl: data.sourceUrl || url,
        instructions: data.instructions || "",
        ingredients: data.ingredientLines.map((line) => {
          const parsed = parseIngredientLine(line);
          return { id: uid(), quantity: parsed.quantity, name: parsed.name, include: true };
        }),
      });
    } catch (e) {
      setFetchError("Couldn't reach that page: " + e.message);
    } finally {
      setFetching(false);
    }
  }

  function parseFromPaste() {
    const lines = parseIngredientsText(pasteValue);
    if (lines.length === 0) return;
    setReview({
      title: pasteTitle.trim(),
      sourceUrl: "",
      instructions: "",
      ingredients: lines.map((l) => ({ id: uid(), quantity: l.quantity, name: l.name, include: true })),
    });
  }

  function updateIngredient(id, field, value) {
    setReview((r) => ({ ...r, ingredients: r.ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i)) }));
  }
  function removeIngredientLine(id) {
    setReview((r) => ({ ...r, ingredients: r.ingredients.filter((i) => i.id !== id) }));
  }
  function addBlankIngredientLine() {
    setReview((r) => ({ ...r, ingredients: [...r.ingredients, { id: uid(), quantity: "", name: "", include: true }] }));
  }

  function save() {
    const ingredients = review.ingredients.filter((i) => i.include && i.name.trim());
    if (ingredients.length === 0) return;
    onSave({ title: review.title.trim() || "Recipe", sourceUrl: review.sourceUrl, instructions: review.instructions, ingredients });
    resetPanel();
  }

  if (meal?.recipe && !open) {
    const r = meal.recipe;
    return (
      <div style={{ marginTop: 6, background: STYLES.amber + "10", border: `1px solid ${STYLES.amber}44`, borderRadius: 4, padding: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
          <ChefHat size={13} color={STYLES.amber} />
          <span style={{ flex: 1, overflowWrap: "anywhere" }}>{r.title}</span>
        </div>
        <div style={{ fontSize: 11, color: STYLES.slate, marginTop: 2, marginBottom: 6 }}>
          {r.ingredients.length} ingredient{r.ingredients.length === 1 ? "" : "s"} in grocery list
          {r.sourceUrl && (
            <> · <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: STYLES.slate }}>source <ExternalLink size={9} style={{ verticalAlign: "middle" }} /></a></>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setOpen(true)} style={smallBtn(false)}>Replace</button>
          <button onClick={onRemove} style={smallBtn(false)}><Trash2 size={12} /> Remove</button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...smallBtn(false), marginTop: 6 }}>
        <ChefHat size={12} /> Add recipe
      </button>
    );
  }

  return (
    <div style={{ marginTop: 6, background: "#fff", border: `1px solid ${STYLES.brass}`, borderRadius: 4, padding: 10 }}>
      {!review ? (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button onClick={() => { setMode("url"); setFetchError(""); }} style={{ ...smallBtn(mode === "url"), flex: 1, justifyContent: "center" }}><Link2 size={12} /> From a URL</button>
            <button onClick={() => { setMode("paste"); setFetchError(""); }} style={{ ...smallBtn(mode === "paste"), flex: 1, justifyContent: "center" }}><ClipboardPaste size={12} /> Paste ingredients</button>
          </div>
          {mode === "url" ? (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={urlValue} onChange={(e) => setUrlValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchFromUrl()} placeholder="Paste a recipe URL…" style={{ ...smallInput, flex: 1 }} />
                <button onClick={fetchFromUrl} disabled={fetching || !urlValue.trim()} style={smallBtn(true)}>{fetching ? "Fetching…" : "Fetch"}</button>
              </div>
              {fetchError && <div style={{ fontSize: 11.5, color: STYLES.wax, marginTop: 6 }}>{fetchError}</div>}
              <div style={{ fontSize: 10.5, color: STYLES.slate, marginTop: 6, fontStyle: "italic" }}>Works for most recipe blogs — reads the same structured recipe data the site gives Google. Some sites don't publish it; paste instead if that happens.</div>
            </>
          ) : (
            <>
              <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Recipe name (optional)" style={{ ...smallInput, width: "100%", boxSizing: "border-box", marginBottom: 6 }} />
              <textarea value={pasteValue} onChange={(e) => setPasteValue(e.target.value)} placeholder={"Paste ingredients, one per line, e.g.\n2 cups flour\n1 tsp salt"} rows={5} style={{ ...smallInput, width: "100%", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button onClick={parseFromPaste} disabled={!pasteValue.trim()} style={smallBtn(true)}>Parse ingredients</button>
              </div>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={resetPanel} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, fontSize: 12 }}><X size={12} /> Cancel</button>
          </div>
        </>
      ) : (
        <>
          <input value={review.title} onChange={(e) => setReview({ ...review, title: e.target.value })} placeholder="Recipe name" style={{ ...smallInput, width: "100%", boxSizing: "border-box", marginBottom: 8, fontWeight: 600 }} />
          <div style={{ fontSize: 10.5, color: STYLES.slate, marginBottom: 4 }}>Review before adding to the grocery list — uncheck or edit anything:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
            {review.ingredients.map((ing) => (
              <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <input type="checkbox" checked={ing.include} onChange={(e) => updateIngredient(ing.id, "include", e.target.checked)} />
                <input value={ing.quantity} onChange={(e) => updateIngredient(ing.id, "quantity", e.target.value)} placeholder="qty" style={{ ...smallInput, width: 70, flexShrink: 0, opacity: ing.include ? 1 : 0.5 }} />
                <input value={ing.name} onChange={(e) => updateIngredient(ing.id, "name", e.target.value)} placeholder="ingredient" style={{ ...smallInput, flex: 1, minWidth: 0, opacity: ing.include ? 1 : 0.5 }} />
                <button onClick={() => removeIngredientLine(ing.id)} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <button onClick={addBlankIngredientLine} style={{ ...smallBtn(false), marginTop: 8 }}><Plus size={12} /> Add line</button>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button onClick={resetPanel} style={{ background: "none", border: `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "6px 11px", cursor: "pointer", fontSize: 12.5 }}>Cancel</button>
            <button onClick={save} style={smallBtn(true)}>Save recipe & add to grocery list</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MealsTab({ meet, currentUser, onUpdate, setError }) {
  const days = dateRange(meet.startDate, meet.endDate);
  const [newGrocery, setNewGrocery] = useState({ name: "", quantity: "", category: "" });

  async function saveMeals(nextMeals) {
    try { await onUpdate({ meals: nextMeals }); } catch (e) { setError("Couldn't save menu: " + e.message); }
  }
  function mealFor(date, mealType) {
    return (meet.meals || []).find((m) => m.date === date && m.mealType === mealType);
  }
  function ensureMeal(date, mealType) {
    let existing = mealFor(date, mealType);
    if (existing) return { meal: existing, meals: meet.meals };
    const created = { id: uid(), date, mealType, menu: "", assignedTo: null, recipe: null };
    return { meal: created, meals: [...(meet.meals || []), created] };
  }
  function setMenu(date, mealType, menu) {
    const existing = mealFor(date, mealType);
    let next;
    if (existing) {
      next = meet.meals.map((m) => (m.id === existing.id ? { ...m, menu } : m));
    } else {
      if (!menu.trim()) return;
      next = [...(meet.meals || []), { id: uid(), date, mealType, menu, assignedTo: null, recipe: null }];
    }
    saveMeals(next);
  }

  async function saveGrocery(nextItems) {
    try { await onUpdate({ groceryItems: nextItems }); } catch (e) { setError("Couldn't save grocery list: " + e.message); }
  }
  function addGroceryItem() {
    const name = newGrocery.name.trim();
    if (!name) return;
    const item = { id: uid(), name, quantity: newGrocery.quantity.trim(), category: newGrocery.category.trim(), checked: false, source: "manual" };
    saveGrocery([...(meet.groceryItems || []), item]);
    setNewGrocery({ name: "", quantity: "", category: "" });
  }
  function toggleGrocery(id) {
    saveGrocery((meet.groceryItems || []).map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)));
  }
  function removeGrocery(id) {
    saveGrocery((meet.groceryItems || []).filter((g) => g.id !== id));
  }

  // Attaching a recipe: save it on the meal entry AND drop its ingredients
  // into the grocery list (tagged with recipeMealId so they can be found
  // and removed together later without touching manually-added items).
  async function saveRecipe(date, mealType, recipeData) {
    const { meal, meals } = ensureMeal(date, mealType);
    const nextMeals = meals.map((m) => (m.id === meal.id ? { ...m, recipe: recipeData } : m));
    const withoutOldRecipeItems = (meet.groceryItems || []).filter((g) => g.recipeMealId !== meal.id);
    const newItems = recipeData.ingredients.map((ing) => ({
      id: uid(), name: ing.name, quantity: ing.quantity, category: recipeData.title, checked: false,
      source: "recipe", recipeMealId: meal.id,
    }));
    try {
      await onUpdate({ meals: nextMeals, groceryItems: [...withoutOldRecipeItems, ...newItems] });
    } catch (e) { setError("Couldn't save recipe: " + e.message); }
  }
  async function removeRecipe(date, mealType) {
    const existing = mealFor(date, mealType);
    if (!existing) return;
    const nextMeals = meet.meals.map((m) => (m.id === existing.id ? { ...m, recipe: null } : m));
    const nextItems = (meet.groceryItems || []).filter((g) => g.recipeMealId !== existing.id);
    try { await onUpdate({ meals: nextMeals, groceryItems: nextItems }); } catch (e) { setError("Couldn't remove recipe: " + e.message); }
  }

  const groceryByCategory = {};
  (meet.groceryItems || []).forEach((g) => {
    const cat = g.category || "Other";
    (groceryByCategory[cat] = groceryByCategory[cat] || []).push(g);
  });

  const textarea = { width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 4, border: `1px solid ${STYLES.ink}22`, fontSize: 13, fontFamily: "inherit", resize: "vertical", minHeight: 34 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><UtensilsCrossed size={14} /> Meal Menus</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {days.map((d) => (
            <div key={d} style={{ border: `1px solid ${STYLES.ink}14`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{formatET(d + "T12:00:00", { weekday: "long", month: "short", day: "numeric" })}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {MEAL_TYPES.map((mt) => {
                  const existing = mealFor(d, mt);
                  return (
                    <div key={mt}>
                      <div style={{ fontSize: 11, color: STYLES.slate, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }}>{mt}</div>
                      <textarea
                        defaultValue={existing?.menu || ""}
                        placeholder={`${mt} plan…`}
                        onBlur={(e) => setMenu(d, mt, e.target.value)}
                        style={textarea}
                      />
                      <RecipeImporter
                        meal={existing}
                        onSave={(recipeData) => saveRecipe(d, mt, recipeData)}
                        onRemove={() => removeRecipe(d, mt)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {days.length === 0 && <div style={{ fontSize: 13, color: STYLES.slate }}>Set the RAPTRMeet's dates first (Dates & Travel tab).</div>}
        </div>
      </section>

      <section style={{ background: "#fff", border: `1px solid ${STYLES.ink}1a`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.ink, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><ShoppingCart size={14} /> Grocery List</div>
        <div style={{ fontSize: 11, color: STYLES.slate, marginBottom: 12, fontStyle: "italic" }}>Add recipes above to auto-fill this list, or add items manually below.</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input value={newGrocery.name} onChange={(e) => setNewGrocery({ ...newGrocery, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addGroceryItem()} placeholder="Item" style={{ flex: "2 1 140px", padding: "7px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13 }} />
          <input value={newGrocery.quantity} onChange={(e) => setNewGrocery({ ...newGrocery, quantity: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addGroceryItem()} placeholder="Qty" style={{ flex: "1 1 70px", padding: "7px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13 }} />
          <input value={newGrocery.category} onChange={(e) => setNewGrocery({ ...newGrocery, category: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addGroceryItem()} placeholder="Category (produce, etc.)" style={{ flex: "1 1 140px", padding: "7px 10px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, fontSize: 13 }} />
          <button onClick={addGroceryItem} style={{ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}><Plus size={14} /> Add</button>
        </div>

        {Object.keys(groceryByCategory).length === 0 ? (
          <div style={{ fontSize: 13, color: STYLES.slate }}>No grocery items yet.</div>
        ) : (
          Object.entries(groceryByCategory).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: STYLES.slate, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{cat}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map((g) => (
                  <li key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: STYLES.ink + "06", borderRadius: 4, padding: "6px 8px" }}>
                    <button onClick={() => toggleGrocery(g.id)} style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${g.checked ? STYLES.brass : STYLES.slate}`, background: g.checked ? STYLES.brass : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                      {g.checked && <Check size={11} color="#fff" />}
                    </button>
                    <span style={{ flex: 1, textDecoration: g.checked ? "line-through" : "none", opacity: g.checked ? 0.55 : 1 }}>{g.name}</span>
                    {g.quantity && <span style={{ color: STYLES.slate, fontSize: 12 }}>{g.quantity}</span>}
                    <button onClick={() => removeGrocery(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0 }}><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
