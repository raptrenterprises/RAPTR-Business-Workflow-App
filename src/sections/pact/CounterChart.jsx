import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { STYLES, todayStr } from "../../constants";
import { buildSeries, OVERALL_KEY, GROUP_KEY } from "../../lib/counterLogic";

const PALETTE = ["#3B6E8F", "#6B4E8E", "#B8860B", "#C1562E", "#4E8E8E", "#8E4E6B", "#7A7A2E", "#5A5A5A"];

// Overall is the heavy wine line, groupings are green / red, and each category gets its own colour
// (solid for positive categories, dashed for negative ones).
function styleFor(series) {
  let i = 0;
  return series.map((s) => {
    if (s.key === OVERALL_KEY) return { ...s, color: STYLES.wax, width: 3, dash: undefined };
    if (s.key === GROUP_KEY.positive) return { ...s, color: "#2E8B57", width: 2.5, dash: undefined };
    if (s.key === GROUP_KEY.negative) return { ...s, color: "#C62828", width: 2.5, dash: undefined };
    const color = PALETTE[i % PALETTE.length];
    i += 1;
    return { ...s, color, width: 1.5, dash: s.kind === "negative" ? "5 4" : undefined };
  });
}

const shortDate = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// Lazy-loaded (like the other charts) so recharts is only fetched when someone opens it.
export default function CounterChart({ categories, daily, users, currentUser }) {
  const [person, setPerson] = useState(currentUser);
  const [hidden, setHidden] = useState({});
  const { series, data } = useMemo(() => {
    const built = buildSeries(categories, daily, person, todayStr());
    return { series: styleFor(built.series), data: built.data };
  }, [categories, daily, person]);

  if (data.length === 0) {
    return <div style={{ fontSize: 13, color: STYLES.slate, padding: "12px 0" }}>Nothing to chart yet. It fills in as you add counts.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {users.map((u) => (
          <button key={u} onClick={() => setPerson(u)} style={{ padding: "6px 14px", borderRadius: 14, cursor: "pointer", fontSize: 13, border: `1px solid ${person === u ? STYLES.wax : STYLES.ink + "33"}`, background: person === u ? STYLES.wax : "#fff", color: person === u ? "#fff" : STYLES.ink }}>{u}</button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={STYLES.ink + "22"} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
          <Tooltip labelFormatter={(d) => d} />
          {series.map((s) => (
            <Line key={s.key} type="stepAfter" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} dot={false} hide={!!hidden[s.key]} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {series.map((s) => (
          <button key={s.key} onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 12, cursor: "pointer", fontSize: 12, border: `1px solid ${STYLES.ink}33`, background: "#fff", color: STYLES.ink, opacity: hidden[s.key] ? 0.4 : 1 }}>
            <span style={{ width: 14, height: 0, borderTop: `${Math.max(2, s.width)}px ${s.dash ? "dashed" : "solid"} ${s.color}` }} />
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: STYLES.slate, marginTop: 8 }}>Tap a name to show or hide its line. Dashed lines are negative categories.</div>
    </div>
  );
}
