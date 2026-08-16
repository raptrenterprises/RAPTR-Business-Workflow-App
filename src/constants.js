export const STYLES = {
  ink: "#000000",
  parchment: "#BBBBBB",
  wax: "#580900",
  rust: "#C1562E",
  brass: "#DF8686",
  slate: "#5A5A5A",
  gray: "#D6D6D6",
  green: "#3E6B4F",
  amber: "#B8860B",
  blue: "#3B6E8F",
  purple: "#6B4E8E",
};

export const EVENT_CATEGORIES = ["Weekly Call", "RAPTRMeet", "Playtest", "Social Media Post Goes Live", "Other"];
export const EVENT_CATEGORY_COLOR = {
  "Weekly Call": STYLES.blue,
  "RAPTRMeet": STYLES.purple,
  "Playtest": STYLES.green,
  "Social Media Post Goes Live": STYLES.amber,
  "Other": STYLES.slate,
};

// Map of Supabase auth email -> display name used throughout the app.
export const USER_DIRECTORY = {
  "cathy@raptrmysteries.com": "Cathy",
  "evan@raptrmysteries.com": "Evan",
};
export const USERS = Object.values(USER_DIRECTORY);

// ---- Importance: how much it matters ----
export const IMPORTANCE_LEVELS = ["Low", "Medium", "High", "Critical"];
export const IMPORTANCE_WEIGHT = { Low: 1, Medium: 2, High: 3, Critical: 4 };
export const IMPORTANCE_LEGEND = {
  Critical: "Critical to the business — finance, legal, functionality, etc.",
  High: "Important for business success.",
  Medium: "Should get done, but not the end of the world if it slips.",
  Low: "Just an idea, for fun, or FYI.",
};

// ---- Urgency: how soon it needs attention ----
export const URGENCY_LEVELS = ["N/A", "Low", "Medium", "High", "Immediate"];
export const URGENCY_WEIGHT = { "N/A": 0, Low: 1, Medium: 2, High: 3, Immediate: 4 };
export const URGENCY_LEGEND = {
  Immediate: "Today.",
  High: "1–3 days.",
  Medium: "Within a week.",
  Low: "Within a month.",
  "N/A": "Eventually — no timeline.",
};

// Explicit priority ranking (urgency/importance), lower index = higher priority.
// Reconstructed from the requested order; High/Medium and Medium/Medium weren't
// specified explicitly, so they're placed here between the "High importance"
// pairs and the "Low importance" pairs, following the pattern of the rest of
// the list — flag if this isn't the placement you had in mind.
const PRIORITY_ORDER = [
  ["Immediate", "Critical"], ["Immediate", "High"], ["Immediate", "Medium"], ["Immediate", "Low"],
  ["High", "Critical"], ["High", "High"],
  ["Medium", "Critical"], ["Medium", "High"],
  ["High", "Medium"], ["Medium", "Medium"], // <- gap-filled, see note above
  ["High", "Low"], ["Medium", "Low"],
  ["Low", "Critical"], ["Low", "High"], ["Low", "Medium"], ["Low", "Low"],
  ["N/A", "Critical"], ["N/A", "High"], ["N/A", "Medium"], ["N/A", "Low"],
];
const PRIORITY_RANK = {};
PRIORITY_ORDER.forEach(([urgency, importance], i) => { PRIORITY_RANK[`${urgency}|${importance}`] = i; });
export function priorityRank(urgency, importance) {
  const key = `${urgency}|${importance}`;
  return key in PRIORITY_RANK ? PRIORITY_RANK[key] : 999;
}

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Whole days from `fromStr` to `toStr` (both 'YYYY-MM-DD'-ish strings; positive = toStr is later).
export function daysBetween(fromStr, toStr) {
  const from = new Date((fromStr || "").slice(0, 10) + "T00:00:00");
  const to = new Date((toStr || "").slice(0, 10) + "T00:00:00");
  return Math.round((to - from) / 86400000);
}

// Auto-escalates a manually-set urgency over time. Only Low and Medium
// escalate; High, Immediate, and N/A are left as-is (no rule was given
// for further escalating those).
//   Low    -> Medium at 3 weeks (21 days) old
//   Medium -> High 4 days after entering Medium (so a Low item that became
//             Medium at day 21 becomes High at day 25; an item that started
//             at Medium becomes High at day 4)
export function escalateUrgency(baseUrgency, createdAt) {
  if (baseUrgency !== "Low" && baseUrgency !== "Medium") return baseUrgency || "Medium";
  const age = daysBetween(createdAt, todayStr());
  if (baseUrgency === "Low") {
    if (age >= 25) return "High";
    if (age >= 21) return "Medium";
    return "Low";
  }
  return age >= 4 ? "High" : "Medium"; // Medium
}

// Derives urgency from how far away a due date is.
//   due today or overdue -> Immediate
//   1–3 days away        -> High
//   4–7 days away         -> Medium
//   8+ days away          -> Low
// (Nothing beyond 30 days was specified as its own tier, so anything
// further out than a week just stays at Low rather than being marked N/A —
// N/A is reserved for items with no due date and no timeline at all.)
export function urgencyFromDueDate(dueDate) {
  const days = daysBetween(todayStr(), dueDate);
  if (days <= 0) return "Immediate";
  if (days <= 3) return "High";
  if (days <= 7) return "Medium";
  return "Low";
}

// The single source of truth for "what urgency is this right now" —
// use this everywhere urgency is displayed, sorted, or filtered.
// Due date always wins if present; otherwise the stored urgency escalates with age.
export function effectiveUrgency(item) {
  if (item.dueDate) return urgencyFromDueDate(item.dueDate);
  return escalateUrgency(item.urgency, item.createdAt);
}

// Sorts highest-priority first, using the same rank table as everywhere else.
export function comparePriority(a, b) {
  return priorityRank(effectiveUrgency(a), a.importance) - priorityRank(effectiveUrgency(b), b.importance);
}

export function addDays(dateOrStr, n) {
  const d = typeof dateOrStr === "string" ? new Date(dateOrStr.slice(0, 10) + "T00:00:00") : new Date(dateOrStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export function advanceDate(dateStr, recurrence) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
export function importanceColor(level) {
  if (level === "Critical") return STYLES.wax;
  if (level === "High") return STYLES.rust;
  if (level === "Medium") return STYLES.brass;
  return STYLES.slate; // Low
}
export function urgencyColor(level) {
  if (level === "Immediate") return STYLES.wax;
  if (level === "High") return STYLES.rust;
  if (level === "Medium") return STYLES.brass;
  if (level === "Low") return STYLES.slate;
  return STYLES.gray; // N/A
}
export const EVENT_RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly (same date)" },
  { value: "yearly", label: "Yearly" },
];

// True if a (possibly recurring) event has an occurrence covering dateStr.
// Recurring events are never materialized into multiple rows — occurrences
// are computed on the fly for whatever date is being checked, so this works
// for any date range without needing to pre-generate anything.
export function eventCoversDay(ev, dateStr) {
  const duration = Math.max(0, daysBetween(ev.date, ev.endDate || ev.date));

  if (!ev.recurrence || ev.recurrence === "none") {
    return dateStr >= ev.date && dateStr <= (ev.endDate || ev.date);
  }
  if (dateStr < ev.date) return false;
  if (ev.recurrenceEnd && dateStr > ev.recurrenceEnd) return false;

  // Check every possible occurrence start that could reach dateStr given the event's duration.
  for (let offset = 0; offset <= duration; offset++) {
    const candidateStart = addDays(dateStr, -offset);
    if (candidateStart < ev.date) continue;
    if (matchesRecurrence(ev.recurrence, ev.date, candidateStart)) return true;
  }
  return false;
}

function matchesRecurrence(recurrence, startStr, candidateStr) {
  const diffDays = daysBetween(startStr, candidateStr);
  if (diffDays < 0) return false;
  if (recurrence === "daily") return true;
  if (recurrence === "weekly") return diffDays % 7 === 0;
  const start = new Date(startStr + "T00:00:00");
  const candidate = new Date(candidateStr + "T00:00:00");
  if (recurrence === "monthly") return candidate.getDate() === start.getDate();
  if (recurrence === "yearly") return candidate.getDate() === start.getDate() && candidate.getMonth() === start.getMonth();
  return false;
}

// True if a (possibly recurring, possibly all-day) event is happening right
// now — defined as between its start time and 2 hours after that start time.
// All-day events count as "happening" for their whole covered day.
export function isEventHappeningNow(ev) {
  const today = todayStr();
  if (!eventCoversDay(ev, today)) return false;
  if (ev.allDay || !ev.time) return true;
  const [h, m] = ev.time.split(":").map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60000); // 2 hours
  const now = new Date();
  return now >= start && now <= end;
}


export function selectStyle() {
  return { padding: "6px 8px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, background: "#fff", fontSize: 13 };
}

// ---- date range helpers for the calendar ----
export function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d;
}
export function endOfWeek(dateStr) {
  const d = startOfWeek(dateStr);
  d.setDate(d.getDate() + 6);
  return d;
}
export function startOfMonth(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
export function toStr(d) {
  return d.toISOString().slice(0, 10);
}
export function withinRange(dateStr, startD, endD) {
  const d = new Date(dateStr + "T00:00:00");
  return d >= startD && d <= endD;
}
