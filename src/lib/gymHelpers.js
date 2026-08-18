// Gym data helpers with no chart/recharts dependency, so both GymSection
// and the Dashboard's Gym card can share this logic without pulling the
// (large) charting library into their main bundle.
import { STYLES, daysBetween, addDays } from "../constants";

export function emptyParticipant() {
  return { startingWeight: null, targetWeight: null, weighIns: [], workouts: [] };
}

// Reads a participant's data with backward-compatible fallbacks for the
// older data shapes (weekly weigh-ins keyed by week number, and plain
// boolean workoutDates instead of typed workouts).
export function normalizeParticipant(raw, challenge) {
  const p = raw || {};
  let weighIns = p.weighIns || [];
  weighIns = weighIns.map((w) => (w.date ? w : { date: addDays(challenge.startDate, (w.week || 0) * 7), weight: w.weight, at: w.at }));
  let workouts = p.workouts;
  if (!workouts) workouts = (p.workoutDates || []).map((d) => ({ date: d, type: "Other" }));
  return { startingWeight: p.startingWeight ?? null, targetWeight: p.targetWeight ?? null, weighIns, workouts };
}

export function weekIndexForDate(startDate, dateStr) {
  return Math.floor(daysBetween(startDate, dateStr) / 7);
}
export function totalWeeks(startDate, endDate) {
  return Math.max(1, Math.ceil(daysBetween(startDate, endDate) / 7));
}
export function targetForDate(p, challenge, dateStr) {
  if (p.startingWeight == null || p.targetWeight == null) return null;
  const totalDays = Math.max(1, daysBetween(challenge.startDate, challenge.endDate));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(challenge.startDate, dateStr)));
  const frac = elapsed / totalDays;
  return p.startingWeight + (p.targetWeight - p.startingWeight) * frac;
}
export function weightStatus(target, actual, startingWeight) {
  if (target == null || actual == null) return "none";
  const losing = startingWeight != null && target < startingWeight;
  const gaining = startingWeight != null && target > startingWeight;
  const diff = actual - target;
  const tol = 1;
  if (losing) { if (diff <= tol) return "good"; if (diff <= tol * 3) return "warn"; return "bad"; }
  if (gaining) { if (diff >= -tol) return "good"; if (diff >= -tol * 3) return "warn"; return "bad"; }
  return Math.abs(diff) <= tol ? "good" : "warn";
}
export const STATUS_COLOR = { good: STYLES.green, warn: STYLES.brass, bad: STYLES.wax, none: STYLES.gray };
export const PARTICIPANT_COLOR = { Cathy: STYLES.purple, Evan: STYLES.blue };
