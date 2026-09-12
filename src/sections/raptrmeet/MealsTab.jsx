import { useState } from "react";
import { Plus, Trash2, Check, UtensilsCrossed, ShoppingCart } from "lucide-react";
import { STYLES, uid, selectStyle, dateRange, MEAL_TYPES, formatET } from "../../constants";

export default function MealsTab({ meet, currentUser, onUpdate, setError }) {
  const days = dateRange(meet.startDate, meet.endDate);
  const [newGrocery, setNewGrocery] = useState({ name: "", quantity: "", category: "" });

  async function saveMeals(nextMeals) {
    try { await onUpdate({ meals: nextMeals }); } catch (e) { setError("Couldn't save menu: " + e.message); }
  }
  function mealFor(date, mealType) {
    return (meet.meals || []).find((m) => m.date === date && m.mealType === mealType);
  }
  function setMenu(date, mealType, menu) {
    const existing = mealFor(date, mealType);
    let next;
    if (existing) {
      next = meet.meals.map((m) => (m.id === existing.id ? { ...m, menu } : m));
    } else {
      if (!menu.trim()) return;
      next = [...(meet.meals || []), { id: uid(), date, mealType, menu, assignedTo: null }];
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
        <div style={{ fontSize: 11, color: STYLES.slate, marginBottom: 12, fontStyle: "italic" }}>Add items manually for now — importing recipes to auto-generate this list is a planned future upgrade.</div>

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
