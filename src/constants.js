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
  High: "Within a week.",
  Medium: "Within a month.",
  Low: "Within 3 months.",
  "N/A": "Eventually, with no timeline (or more than 3 months away).",
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

export const WORKOUT_TYPES = ["Weights", "Barre", "Rowing", "Running", "Swimming", "Other Cardio", "Other Strength", "Other Flexibility", "Other"];

// ---- RAPTRMeet ----
export const TASK_TAGS = ["Business", "Social Media", "Mystery Creation", "Fun"];
export const TASK_TAG_COLOR = {
  "Business": STYLES.blue,
  "Social Media": STYLES.purple,
  "Mystery Creation": STYLES.rust,
  "Fun": STYLES.green,
};
export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
export const TIMEBLOCKS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];
export const TRAVEL_MODES = ["Driving", "Flying", "Train", "Other"];
export const GROCERY_CATEGORIES = ["Produce", "Dairy & Eggs", "Meat & Seafood", "Bakery", "Pantry & Dry Goods", "Frozen", "Beverages", "Spices & Condiments", "Other"];

// Inclusive array of 'YYYY-MM-DD' date strings from startStr to endStr.
export function dateRange(startStr, endStr) {
  if (!startStr || !endStr) return [];
  const out = [];
  let cur = startStr;
  let guard = 0;
  while (cur <= endStr && guard < 60) { out.push(cur); cur = addDays(cur, 1); guard++; }
  return out;
}
// True if two [aStart,aEnd] / [bStart,bEnd] inclusive date ranges overlap at all.
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
export const TIME_ZONE = "America/New_York";

// "Today" and "now", anchored to Eastern time regardless of the device's
// own timezone — matters for two people who might not always be in the
// same place, and for consistent urgency/overdue calculations.
export function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}
export function nowPartsET() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return { hour: Number(map.hour) % 24, minute: Number(map.minute) };
}
// Converts a value to its Eastern-time calendar date string. Plain
// 'YYYY-MM-DD' strings (due dates, event dates) are already timezone-free
// wall-clock dates and pass through unchanged; full timestamps (createdAt,
// message .at fields) get converted from their UTC instant to the Eastern
// calendar day that instant falls on.
export function toEasternDateStr(input) {
  if (typeof input === "string" && input.length === 10) return input;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(input));
}
// Formats a value for display, always in Eastern time regardless of device timezone.
export function formatET(input, options) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ...options }).format(new Date(input));
}
// Formats a stored 24-hour "HH:MM" time string as "h:mm AM/PM" (Eastern is
// implicit — these are wall-clock times someone typed in, not UTC instants).
export function formatClockTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(d);
}

// Whole days from `fromStr` to `toStr` (both 'YYYY-MM-DD'-ish strings, or
// full timestamps — either is normalized to its Eastern calendar date first).
export function daysBetween(fromStr, toStr) {
  const from = new Date(toEasternDateStr(fromStr) + "T00:00:00");
  const to = new Date(toEasternDateStr(toStr) + "T00:00:00");
  return Math.round((to - from) / 86400000);
}

// ---- How urgent something is right now ----
// Everything is measured in days until an "urgency date":
//   today or overdue -> Immediate    1-7 days -> High    8-30 days -> Medium
//   31-90 days       -> Low          91+ days -> N/A (eventually / no timeline)
export function urgencyFromDays(days) {
  if (days <= 0) return "Immediate";
  if (days <= 7) return "High";
  if (days <= 30) return "Medium";
  if (days <= 90) return "Low";
  return "N/A";
}

// Derives urgency from how far away a date is (a due date, or a RAPTRMeet's date).
export function urgencyFromDueDate(dueDate) {
  return urgencyFromDays(daysBetween(todayStr(), dueDate));
}

// A manually set urgency counts down from the day it was set, using the same scale:
// Low = 90 days, Medium = 30, High = 7, Immediate = today. So a Low item becomes Medium
// with a month left and High with a week left; Immediate and N/A never change on their own.
// Changing the urgency (or restarting its timeline) sets "setAt" to now and starts over.
export const URGENCY_HORIZON_DAYS = { Immediate: 0, High: 7, Medium: 30, Low: 90 };
export function escalateUrgency(baseUrgency, setAt) {
  const base = baseUrgency || "Medium";
  if (base === "N/A") return "N/A";
  const horizon = base in URGENCY_HORIZON_DAYS ? URGENCY_HORIZON_DAYS[base] : URGENCY_HORIZON_DAYS.Medium;
  return urgencyFromDays(horizon - daysBetween(setAt, todayStr()));
}

// The single source of truth for "what urgency is this right now" —
// use this everywhere urgency is displayed, sorted, or filtered.
// 1) a due date wins; 2) otherwise a task tied to a RAPTRMeet follows that meet's date
// (item.meetDate, filled in when tasks are loaded); 3) otherwise the manual urgency counts
// down from when it was last set (item.urgencySetAt, falling back to when it was created).
export function effectiveUrgency(item) {
  if (item.dueDate) return urgencyFromDueDate(item.dueDate);
  if (item.meetDate) return urgencyFromDueDate(item.meetDate);
  return escalateUrgency(item.urgency, item.urgencySetAt || item.createdAt);
}

// Sorts highest-priority first, using the same rank table as everywhere else.
export function comparePriority(a, b) {
  return priorityRank(effectiveUrgency(a), a.importance) - priorityRank(effectiveUrgency(b), b.importance);
}

export function addDays(dateOrStr, n) {
  const base = typeof dateOrStr === "string" ? toEasternDateStr(dateOrStr) : new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(dateOrStr));
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA").format(d);
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
  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + 2 * 60; // 2 hours
  const { hour, minute } = nowPartsET();
  const nowMinutes = hour * 60 + minute;
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}


export function selectStyle() {
  return { padding: "6px 8px", borderRadius: 4, border: `1px solid ${STYLES.ink}33`, background: "#fff", fontSize: 13 };
}

// ---- date range helpers for the calendar ----
export function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = day === 0 ? 6 : day - 1; // days to step back to reach Monday
  d.setDate(d.getDate() - diff);
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
