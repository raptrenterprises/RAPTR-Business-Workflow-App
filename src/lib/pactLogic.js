// Pact helpers for the screens. The scoring itself (combined score, thresholds, result category and the
// estimated time of enactment) is worked out inside the database (migrations/022_pact_private.sql) so that
// neither person ever receives the other's rating. This file only holds labels, validation and dates.
import { todayStr } from "../constants";

export const PACT_STATUSES = ["Single", "In a relationship", "Married"];

export const MIN_INTEREST = 0;
export const MAX_INTEREST = 100;

// The Dashboard's Pact card appears on this day of the month (1 = the first) and stays
// for each person until they have submitted their own vote for that month.
export const PACT_OPEN_DAY = 1;

// The three outcomes. "Sex to decide" and its emoji are kept exactly as specified.
export const PACT_RESULTS = {
  strong: {
    label: "Strong interest",
    emoji: "",
    recommendation: "Initiate. You're both clearly in, so go for it.",
  },
  moderate: {
    label: "Sex to decide",
    emoji: "😏",
    recommendation: "Initiating is on the table. Test the waters and see where it goes.",
  },
  below: {
    label: "Below the moderate-interest threshold",
    emoji: "",
    recommendation: "Hold off on initiating this month. Check in again next month.",
  },
};

// 'YYYY-MM' for a 'YYYY-MM-DD' date string (defaults to today, Eastern time).
export function pactMonthKey(dateStr = todayStr()) {
  return dateStr.slice(0, 7);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// '2026-10' -> 'Oct 2026' (short) or 'October 2026' (long). Also accepts a full 'YYYY-MM-DD'.
export function pactMonthLabel(key, long = false) {
  const [y, m] = key.slice(0, 7).split("-");
  const names = long ? MONTH_NAMES_LONG : MONTH_NAMES;
  return `${names[Number(m) - 1]} ${y}`;
}

// Checks the rating box before saving. Returns "" when valid, otherwise a message to show.
// Nothing missing or out of range is accepted.
export function validateInterest(raw) {
  const n = Number(raw);
  if (raw === "" || raw == null || !Number.isInteger(n) || n < MIN_INTEREST || n > MAX_INTEREST) {
    return `The interest rating must be a whole number from ${MIN_INTEREST} to ${MAX_INTEREST}.`;
  }
  return "";
}

// True when the Dashboard card should show for this person: it's on/after the open day this month,
// and they haven't submitted their own vote for this month yet. `myVotes` is only ever this
// person's own votes (the database won't return anyone else's).
export function isPactDue(myVotes, today = todayStr()) {
  const day = Number(today.slice(8, 10));
  if (day < PACT_OPEN_DAY) return false;
  const month = pactMonthKey(today);
  return !myVotes.some((v) => v.month === month);
}

// ---- Estimated time of enactment (ETE) wording ----
function trimMonths(n) {
  return String(Number(Number(n).toFixed(1)));
}

// One short line for a history row.
export function eteText(row) {
  switch (row.eteStatus) {
    case "estimated":
      return `${pactMonthLabel(row.eteDate)} (about ${trimMonths(row.monthsToGo)} months out)`;
    case "reached": return "Reached";
    case "need_more_data": return "Needs another month of votes";
    case "no_trend": return "No upward trend yet";
    case "too_far": return "More than 5 years out";
    default: return "";
  }
}
