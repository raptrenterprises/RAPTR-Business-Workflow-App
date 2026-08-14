export const STYLES = {
  ink: "#1B2430",
  parchment: "#F3EEE0",
  wax: "#8B2E2E",
  brass: "#B8935F",
  slate: "#5B6675",
  green: "#3E6B4F",
  amber: "#B8860B",
};

// Map of Supabase auth email -> display name used throughout the app.
export const USER_DIRECTORY = {
  "cathy@raptrmysteries.com": "Cathy",
  "evan@raptrmysteries.com": "Evan",
};
export const USERS = Object.values(USER_DIRECTORY);

export const IMPORTANCE_LEVELS = ["Low", "Medium", "High"];
export const IMPORTANCE_WEIGHT = { Low: 1, Medium: 2, High: 3 };
export const IMPORTANCE_LEGEND = {
  High: "Must get done — business critical.",
  Medium: "Should get done, but not the end of the world if it slips.",
  Low: "Just an idea, for fun, or FYI.",
};

export const URGENCY_LEVELS = ["N/A", "Low", "Medium", "High", "Critical"];
export const URGENCY_WEIGHT = { "N/A": 0, Low: 1, Medium: 2, High: 3, Critical: 4 };
export const URGENCY_LEGEND = {
  Critical: "Today.",
  High: "1–3 days.",
  Medium: "Within a week.",
  Low: "Within a month.",
  "N/A": "Eventually — no timeline.",
};

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function uid() { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16); }); }
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
  return level === "High" ? STYLES.wax : level === "Medium" ? STYLES.brass : STYLES.slate;
}
export function urgencyColor(level) {
  if (level === "Critical") return STYLES.wax;
  if (level === "High") return "#C1562E";
  if (level === "Medium") return STYLES.brass;
  if (level === "Low") return STYLES.slate;
  return "#9AA3AE"; // N/A
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
