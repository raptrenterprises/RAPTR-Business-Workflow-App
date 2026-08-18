import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { STYLES, daysBetween, addDays, TIME_ZONE } from "../constants";
import { normalizeParticipant, targetForDate, PARTICIPANT_COLOR } from "../lib/gymHelpers";

// Isolated in its own file (and lazy-loaded by anything that shows it) so
// recharts — a genuinely large library — only gets fetched when someone
// actually views a chart, not on every page load.
export default function WeightChart({ challenge, users }) {
  const totalDays = Math.max(1, daysBetween(challenge.startDate, challenge.endDate));
  const dateSet = new Set([challenge.startDate, challenge.endDate]);
  const participants = {};
  users.forEach((u) => {
    const p = normalizeParticipant(challenge.participants[u], challenge);
    participants[u] = p;
    p.weighIns.forEach((w) => dateSet.add(w.date));
    p.workouts.forEach((w) => dateSet.add(w.date));
  });
  const dates = Array.from(dateSet).sort();

  // First pass: actual + target values, keyed by day-offset so the x-axis
  // can be a real numeric date scale instead of evenly-spaced categories.
  const baseData = dates.map((date) => {
    const point = { dayOffset: daysBetween(challenge.startDate, date), date };
    users.forEach((u) => {
      const p = participants[u];
      const w = p.weighIns.find((w) => w.date === date);
      if (w) point[`${u}_actual`] = w.weight;
      const t = targetForDate(p, challenge, date);
      if (t != null) point[`${u}_target`] = Math.round(t * 10) / 10;
    });
    return point;
  });

  const hasAnyTargets = users.some((u) => participants[u].startingWeight != null && participants[u].targetWeight != null);
  if (!hasAnyTargets) return null;

  const allValues = baseData.flatMap((d) => users.flatMap((u) => [d[`${u}_actual`], d[`${u}_target`]])).filter((v) => v != null);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const pad = Math.max((maxVal - minVal) * 0.15, 3);
  const yMin = Math.floor(minVal - pad);
  const yMax = Math.ceil(maxVal + pad);

  // Second pass: plot a small marker at the bottom of the chart on any day
  // a workout was logged, using the padded y-min as a baseline.
  const data = baseData.map((point) => {
    const next = { ...point };
    users.forEach((u) => {
      const worked = participants[u].workouts.some((w) => w.date === point.date);
      if (worked) next[`${u}_workout`] = yMin;
    });
    return next;
  });

  const tickFormatter = (value) => {
    const label = addDays(challenge.startDate, value);
    return new Date(label + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: TIME_ZONE });
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: STYLES.ink, fontFamily: "Georgia, serif" }}>Weight vs Target</div>
      <div style={{ fontSize: 11, color: STYLES.slate, marginBottom: 8 }}>Solid = actual, dashed = target. Small markers along the bottom = a workout was logged that day.</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={STYLES.ink + "22"} />
          <XAxis dataKey="dayOffset" type="number" domain={[0, totalDays]} tickFormatter={tickFormatter} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[yMin, yMax]} />
          <Tooltip labelFormatter={(value) => tickFormatter(value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {users.flatMap((u) => {
            const color = PARTICIPANT_COLOR[u] || STYLES.brass;
            return [
              <Line key={`${u}-actual`} type="monotone" dataKey={`${u}_actual`} name={u} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls />,
              <Line key={`${u}-target`} type="monotone" dataKey={`${u}_target`} legendType="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />,
              <Line key={`${u}-workout`} type="monotone" dataKey={`${u}_workout`} legendType="none" stroke="none" isAnimationActive={false} dot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 1 }} />,
            ];
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
