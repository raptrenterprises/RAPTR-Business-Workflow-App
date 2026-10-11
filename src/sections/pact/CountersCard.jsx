import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Settings, Trash2, Plus, LineChart } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import {
  fetchCounterCategories, fetchCounterDaily, addCounterEvent,
  addCounterCategory, renameCounterCategory, removeCounterCategory, subscribeCounters,
} from "../../lib/pactApi";
import { COUNTER_GROUPS, AMOUNTS, personTotals } from "../../lib/counterLogic";

const CounterChart = lazy(() => import("./CounterChart"));

const cardStyle = { background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18 };
const smallBtn = (disabled, solid = true) => ({
  background: solid ? STYLES.wax : "transparent", color: solid ? "#fff" : STYLES.slate,
  border: solid ? "none" : `1px solid ${STYLES.slate}`, borderRadius: 4, padding: "7px 14px",
  cursor: disabled ? "default" : "pointer", fontSize: 13, opacity: disabled ? 0.55 : 1,
});
const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));
const groupColor = (kind) => (kind === "positive" ? "#2E8B57" : "#C62828");

// +1 (minor) and +5 (major). Only shown on your own side.
function PersonCell({ name, count, mine, busy, onAdd }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${STYLES.ink}1f`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: STYLES.slate }}>{name}</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>{count}</div>
      {mine && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
          {AMOUNTS.map((a) => (
            <button key={a.amount} disabled={busy} onClick={() => onAdd(a.amount)} aria-label={a.amount === 1 ? "Add one (minor)" : "Add five (major)"} style={smallBtn(busy)}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupBlock({ group, categories, users, totals, currentUser, busy, onAdd }) {
  const cats = categories.filter((c) => c.kind === group.kind);
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6, borderBottom: `2px solid ${groupColor(group.kind)}`, paddingBottom: 4, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: groupColor(group.kind) }}>{group.label}</div>
        <div style={{ fontSize: 13, color: STYLES.slate }}>
          {users.map((u) => `${u} ${totals[u][group.kind]}`).join("  ·  ")}
        </div>
      </div>
      {cats.length === 0 && <div style={{ fontSize: 13, color: STYLES.slate }}>No categories yet. Add one with the gear.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cats.map((c) => (
          <div key={c.id}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {users.map((u) => (
                <PersonCell key={u} name={u} count={totals[u].byCat[c.id] ?? 0} mine={u === currentUser} busy={busy} onAdd={(amount) => onAdd(c.id, amount)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// One category in the settings list: rename it or remove it.
function CategoryRow({ category, busy, onRename, onRemove }) {
  const [value, setValue] = useState(category.name);
  const changed = value.trim() !== category.name && value.trim() !== "";
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
      <input
        value={value} maxLength={40} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && changed) onRename(category.id, value); }}
        style={{ ...selectStyle(), flex: 1, minWidth: 0, fontSize: 14 }}
        aria-label={`Name of ${category.name}`}
      />
      {changed && <button onClick={() => onRename(category.id, value)} disabled={busy} style={smallBtn(busy)}>Save</button>}
      <button onClick={() => onRemove(category)} disabled={busy} aria-label={`Remove ${category.name}`} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex", padding: 4 }}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function AddCategory({ kind, busy, onAdd }) {
  const [value, setValue] = useState("");
  function add() {
    if (!value.trim()) return;
    onAdd(kind, value);
    setValue("");
  }
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      <input
        value={value} maxLength={40} placeholder="New category" onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        style={{ ...selectStyle(), flex: 1, minWidth: 0, fontSize: 14 }}
      />
      <button onClick={add} disabled={busy || !value.trim()} style={{ ...smallBtn(busy || !value.trim()), display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={14} /> Add</button>
    </div>
  );
}

function CountersSettings({ categories, busy, onAdd, onRename, onRemove, onClose }) {
  return (
    <div style={{ background: STYLES.brass + "14", border: `1px solid ${STYLES.brass}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 10 }}>
        Add, rename or remove categories. Removing one also deletes its counts for both of you. Either of you can change these.
      </div>
      {COUNTER_GROUPS.map((g) => (
        <div key={g.kind} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: groupColor(g.kind), marginBottom: 6 }}>{g.label}</div>
          {categories.filter((c) => c.kind === g.kind).map((c) => (
            <CategoryRow key={c.id + c.name} category={c} busy={busy} onRename={onRename} onRemove={onRemove} />
          ))}
          <AddCategory kind={g.kind} busy={busy} onAdd={onAdd} />
        </div>
      ))}
      <button onClick={onClose} style={smallBtn(false, false)}>Done</button>
    </div>
  );
}

export default function CountersCard({ currentUser, users }) {
  const [categories, setCategories] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([fetchCounterCategories(), fetchCounterDaily()]);
      setCategories(c); setDaily(d); setError("");
    } catch (e) {
      setError("Couldn't load the counters: " + e.message + " (has migration 023_pact_counters.sql been run?)");
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    return subscribeCounters(reload);
  }, [reload]);

  // Per person: count for each category, each grouping, and overall (positive minus negative).
  const totals = useMemo(() => {
    const t = {};
    users.forEach((u) => { t[u] = personTotals(categories, daily, u); });
    return t;
  }, [users, categories, daily]);

  async function run(fn, failMsg) {
    setBusy(true);
    try { await fn(); await reload(); setError(""); }
    catch (e) { setError(failMsg + e.message); }
    finally { setBusy(false); }
  }
  const addCount = (categoryId, amount) => run(() => addCounterEvent(categoryId, currentUser, amount), "Couldn't add to the counter: ");
  const addCategory = (kind, name) => run(() => addCounterCategory(kind, name), "Couldn't add the category: ");
  const rename = (id, name) => run(() => renameCounterCategory(id, name), "Couldn't rename the category: ");
  function remove(category) {
    if (!window.confirm(`Remove "${category.name}"? This also deletes its counts for both of you.`)) return;
    run(() => removeCounterCategory(category.id), "Couldn't remove the category: ");
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700 }}>Microaggression Counters</div>
        <button onClick={() => setSettingsOpen((o) => !o)} aria-label="Counter settings" title="Counter settings" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex", padding: 4 }}>
          <Settings size={18} />
        </button>
      </div>

      {error && <div style={{ fontSize: 13, color: STYLES.wax, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      {settingsOpen && (
        <CountersSettings categories={categories} busy={busy} onAdd={addCategory} onRename={rename} onRemove={remove} onClose={() => setSettingsOpen(false)} />
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: STYLES.slate }}>Loading counters…</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {users.map((u) => (
              <div key={u} style={{ flex: 1, background: STYLES.brass + "14", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: STYLES.slate }}>{u} overall</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, color: STYLES.wax, lineHeight: 1.15 }}>{fmt(totals[u].overall)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: STYLES.slate, textAlign: "center", marginTop: 4 }}>Overall = positive minus negative</div>

          {COUNTER_GROUPS.map((g) => (
            <GroupBlock key={g.kind} group={g} categories={categories} users={users} totals={totals} currentUser={currentUser} busy={busy} onAdd={addCount} />
          ))}

          <div style={{ marginTop: 18 }}>
            <button onClick={() => setChartOpen((o) => !o)} style={{ ...smallBtn(false, false), display: "inline-flex", alignItems: "center", gap: 6 }}>
              <LineChart size={14} /> {chartOpen ? "Hide chart" : "Show chart"}
            </button>
            {chartOpen && (
              <div style={{ marginTop: 12 }}>
                <Suspense fallback={<div style={{ fontSize: 12, color: STYLES.slate }}>Loading chart…</div>}>
                  <CounterChart categories={categories} daily={daily} users={users} currentUser={currentUser} />
                </Suspense>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
