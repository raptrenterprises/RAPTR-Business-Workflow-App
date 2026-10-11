import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { STYLES } from "../../constants";
import { calcPact, pactMonthLabel } from "../../lib/pactLogic";

// Isolated in its own file and lazy-loaded (same as WeightChart) so recharts is only
// fetched when someone opens the History tab. Shows combined score and the two thresholds
// per month. Never individual ratings.
export default function PactHistoryChart({ votes, users }) {
  const data = votes
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((v) => {
      const r = calcPact(v.ballots, users);
      return { month: pactMonthLabel(v.month), score: r.total, moderate: r.moderate, strong: r.strong };
    });

  const top = Math.max(...data.flatMap((d) => [d.score, d.moderate, d.strong]));
  const yMax = Math.ceil((top + 10) / 10) * 10;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={STYLES.ink + "22"} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} domain={[0, yMax]} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="score" name="Combined score" stroke={STYLES.wax} strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="moderate" name="Moderate threshold" stroke={STYLES.amber} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="strong" name="Strong threshold" stroke={STYLES.green} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
