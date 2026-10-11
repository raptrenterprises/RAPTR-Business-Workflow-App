import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { STYLES } from "../../constants";
import { pactMonthLabel, eteText } from "../../lib/pactLogic";

const DAY_MS = 86400000;
const toMs = (dateStr) => new Date(dateStr + "T00:00:00Z").getTime();
const msLabel = (ms) => pactMonthLabel(new Date(ms).toISOString());

// Isolated in its own file and lazy-loaded (same as WeightChart) so recharts is only fetched when
// someone opens the History tab. Each point is the estimated time of enactment as it stood at that
// month's vote. It shows no ratings and no scores.
export default function PactHistoryChart({ rows }) {
  const data = rows
    .filter((r) => r.eteDate)
    .map((r) => ({ month: pactMonthLabel(r.month), ete: toMs(r.eteDate), row: r }));

  const lo = Math.min(...data.map((d) => d.ete)) - 20 * DAY_MS;
  const hi = Math.max(...data.map((d) => d.ete)) + 20 * DAY_MS;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={STYLES.ink + "22"} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis type="number" domain={[lo, hi]} tickFormatter={msLabel} tick={{ fontSize: 11 }} width={70} tickCount={5} />
        <Tooltip formatter={(_v, _n, item) => eteText(item.payload.row)} labelFormatter={(label) => `Vote: ${label}`} />
        <Line type="monotone" dataKey="ete" name="Estimated enactment" stroke={STYLES.wax} strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
