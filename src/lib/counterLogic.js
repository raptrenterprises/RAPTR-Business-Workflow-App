// Counter maths for the microaggression counters. Pure functions, no React or Supabase.
// A counter only ever goes up (+1 minor, +5 major). Overall = sum of positive counters - sum of negative ones.

export const COUNTER_GROUPS = [
  { kind: "positive", label: "Positive", sign: "+" },
  { kind: "negative", label: "Negative", sign: "−" },
];
export const AMOUNTS = [{ amount: 1, label: "+1" }, { amount: 5, label: "+5" }]; // minor, major

// `daily` rows look like { day: 'YYYY-MM-DD', categoryId, person, total }.

// One person's current counts: per category, per grouping, and overall (positive minus negative).
export function personTotals(categories, daily, person) {
  const byCat = {};
  categories.forEach((c) => { byCat[c.id] = 0; });
  daily.forEach((d) => { if (d.person === person && d.categoryId in byCat) byCat[d.categoryId] += d.total; });
  let positive = 0;
  let negative = 0;
  categories.forEach((c) => { if (c.kind === "positive") positive += byCat[c.id]; else negative += byCat[c.id]; });
  return { byCat, positive, negative, overall: positive - negative };
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const categoryKey = (id) => `c:${id}`;
export const GROUP_KEY = { positive: "g:positive", negative: "g:negative" };
export const OVERALL_KEY = "overall";

// Cumulative totals over time for one person: one line per category, one per grouping, and the overall sum.
// The timeline runs from the first count by either of you up to today, so both people's charts line up.
export function buildSeries(categories, daily, person, today) {
  const series = [
    { key: OVERALL_KEY, label: "Overall (positive − negative)", type: "overall" },
    { key: GROUP_KEY.positive, label: "Positive total", type: "group", kind: "positive" },
    { key: GROUP_KEY.negative, label: "Negative total", type: "group", kind: "negative" },
    ...categories
      .filter((c) => c.kind === "positive").map((c) => ({ key: categoryKey(c.id), label: `+ ${c.name}`, type: "category", kind: "positive" })),
    ...categories
      .filter((c) => c.kind === "negative").map((c) => ({ key: categoryKey(c.id), label: `− ${c.name}`, type: "category", kind: "negative" })),
  ];
  if (daily.length === 0) return { series, data: [] };

  const catKind = {};
  categories.forEach((c) => { catKind[c.id] = c.kind; });
  const byDay = new Map();
  let first = daily[0].day;
  let last = today;
  daily.forEach((d) => {
    if (d.day < first) first = d.day;
    if (d.day > last) last = d.day;
    if (d.person !== person || !(d.categoryId in catKind)) return;
    if (!byDay.has(d.day)) byDay.set(d.day, []);
    byDay.get(d.day).push(d);
  });

  const running = {};
  categories.forEach((c) => { running[c.id] = 0; });
  const data = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    (byDay.get(day) || []).forEach((d) => { running[d.categoryId] += d.total; });
    let pos = 0;
    let neg = 0;
    const row = { date: day };
    categories.forEach((c) => {
      row[categoryKey(c.id)] = running[c.id];
      if (c.kind === "positive") pos += running[c.id]; else neg += running[c.id];
    });
    row[GROUP_KEY.positive] = pos;
    row[GROUP_KEY.negative] = neg;
    row[OVERALL_KEY] = pos - neg;
    data.push(row);
  }
  return { series, data };
}
