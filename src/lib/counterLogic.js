// Counter maths for the micro / macro aggression counters. Pure functions, no React or Supabase.
// Every click adds one count of a kind to a category: micro or macro. Counters only ever go up.
// Micro and macro are tracked separately and never added together.
// Per kind, the overall total = the sum of the positive counters minus the sum of the negative ones.

export const COUNTER_GROUPS = [
  { kind: "positive", label: "Positive", sign: "+" },
  { kind: "negative", label: "Negative", sign: "−" },
];
export const COUNT_KINDS = [
  { kind: "micro", label: "Micro" },
  { kind: "macro", label: "Macro" },
];

// `daily` rows look like { day: 'YYYY-MM-DD', categoryId, person, kind: 'micro' | 'macro', total }.

const zero = () => ({ micro: 0, macro: 0 });

// One person's current counts, each as { micro, macro }: per category, per grouping, and overall (positive minus negative).
export function personTotals(categories, daily, person) {
  const byCat = {};
  categories.forEach((c) => { byCat[c.id] = zero(); });
  daily.forEach((d) => {
    if (d.person === person && d.categoryId in byCat && (d.kind === "micro" || d.kind === "macro")) byCat[d.categoryId][d.kind] += d.total;
  });
  const positive = zero();
  const negative = zero();
  categories.forEach((c) => {
    const target = c.kind === "positive" ? positive : negative;
    target.micro += byCat[c.id].micro;
    target.macro += byCat[c.id].macro;
  });
  return { byCat, positive, negative, overall: { micro: positive.micro - negative.micro, macro: positive.macro - negative.macro } };
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const categoryKey = (id) => `c:${id}`;
export const GROUP_KEY = { positive: "g:positive", negative: "g:negative" };
export const OVERALL_KEY = "overall";

// Cumulative totals over time for one person and one kind (micro or macro): one line per category, one per
// grouping, and the overall sum. The timeline runs from the first count by either of you (of either kind) up to
// today, so both people's charts, and the micro and macro views, line up.
export function buildSeries(categories, daily, person, kind, today) {
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
    if (d.person !== person || d.kind !== kind || !(d.categoryId in catKind)) return;
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
