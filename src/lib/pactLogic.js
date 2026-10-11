// Pact rules and helpers. Pure functions only (no React, no Supabase, no charting library),
// so the Pact section, the Dashboard card and the history chart all use the exact same rules.
import { todayStr } from "../constants";

export const PACT_STATUSES = ["Single", "In a relationship", "Married"];

// Added to BOTH thresholds, once per participant (so the two adjustments stack).
export const STATUS_ADJUSTMENT = { "Single": 0, "In a relationship": 10, "Married": 25 };

export const BASE_MODERATE = 75;
export const BASE_STRONG = 100;
export const MIN_INTEREST = 1;
export const MAX_INTEREST = 100;

// The Dashboard's Pact card appears on this day of the month (1 = the first) and stays
// until that month's vote is submitted. Change this one number to move it.
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

// '2026-10' -> 'Oct 2026' (short) or 'October 2026' (long)
export function pactMonthLabel(monthKey, long = false) {
  const [y, m] = monthKey.split("-");
  const names = long ? MONTH_NAMES_LONG : MONTH_NAMES;
  return `${names[Number(m) - 1]} ${y}`;
}

// Combined score, thresholds and category for one month's ballots.
// `users` is the list of participants (Cathy and Evan); each needs a status and an interest.
export function calcPact(ballots, users) {
  let total = 0;
  let adjustment = 0;
  users.forEach((u) => {
    const b = ballots[u] || {};
    total += Number(b.interest) || 0;
    adjustment += STATUS_ADJUSTMENT[b.status] ?? 0;
  });
  const moderate = BASE_MODERATE + adjustment;
  const strong = BASE_STRONG + adjustment;
  const level = total >= strong ? "strong" : total >= moderate ? "moderate" : "below";
  return { total, adjustment, moderate, strong, level };
}

// Checks a draft ballot set before saving. Draft interest values may still be strings from the inputs.
// Returns "" when valid, otherwise a message to show. Nothing missing or out of range is accepted.
export function validateBallots(ballots, users) {
  for (const u of users) {
    const b = ballots[u] || {};
    if (!PACT_STATUSES.includes(b.status)) return `Choose a relationship status for ${u}.`;
    const raw = b.interest;
    const n = Number(raw);
    if (raw === "" || raw == null || !Number.isInteger(n) || n < MIN_INTEREST || n > MAX_INTEREST) {
      return `${u}'s interest rating must be a whole number from ${MIN_INTEREST} to ${MAX_INTEREST}.`;
    }
  }
  return "";
}

// Turns validated draft ballots into the stored shape (numbers, only the fields we keep).
export function cleanBallots(ballots, users) {
  const out = {};
  users.forEach((u) => { out[u] = { status: ballots[u].status, interest: Number(ballots[u].interest) }; });
  return out;
}

// True when the Dashboard card should show: it's on/after the open day this month,
// and nothing has been submitted for this month yet.
export function isPactDue(votes, today = todayStr()) {
  const day = Number(today.slice(8, 10));
  if (day < PACT_OPEN_DAY) return false;
  const month = pactMonthKey(today);
  return !votes.some((v) => v.month === month);
}
