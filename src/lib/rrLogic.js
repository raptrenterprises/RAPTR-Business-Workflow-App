// Pure helpers for the raptrraptr Holidays and Documents sub-sections. No React, no Supabase.
import { todayStr } from "../constants";

// ---- Holidays ----

export const FIRST_YEAR_MIN = 1900;
export const FIRST_YEAR_MAX = 2200;

export function currentYear(today = todayStr()) {
  return Number(today.slice(0, 4));
}

// '' or a whole year in range -> true
export function validYearInput(raw) {
  if (raw === "" || raw == null) return true;
  const n = Number(raw);
  return Number.isInteger(n) && n >= FIRST_YEAR_MIN && n <= FIRST_YEAR_MAX;
}

// The next 10-year anniversary year of the first celebration: first + 10, first + 20, ...
// The first one at or after the current year, so the anniversary year itself counts as "upcoming" for that
// whole year. The first celebration's own year never counts (it's year zero). Null if there's no first year.
export function nextTenYear(firstYear, thisYear = currentYear()) {
  if (!Number.isInteger(firstYear)) return null;
  const k = Math.max(1, Math.ceil((thisYear - firstYear) / 10));
  return firstYear + 10 * k;
}

// "this year" / "next year" / "in 7 years"
export function yearsAwayText(year, thisYear = currentYear()) {
  const d = year - thisYear;
  if (d === 0) return "this year";
  if (d === 1) return "next year";
  return `in ${d} years`;
}

// Turns free text into display blocks. A line starting with "- ", "* " or "• " is a bullet; two spaces of
// indent per level makes a sub-bullet (up to 3 levels); anything else is plain text. Blank lines separate.
export function parseRichText(text) {
  const blocks = [];
  String(text || "").replace(/\r\n?/g, "\n").split("\n").forEach((raw) => {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      if (blocks.length && blocks[blocks.length - 1].type !== "gap") blocks.push({ type: "gap" });
      return;
    }
    const m = line.match(/^(\s*)([-*•])\s+(.*)$/);
    if (m) {
      const level = Math.min(3, Math.floor(m[1].replace(/\t/g, "  ").length / 2));
      blocks.push({ type: "bullet", level, text: m[3] });
    } else {
      blocks.push({ type: "text", text: line.trim() });
    }
  });
  while (blocks.length && blocks[blocks.length - 1].type === "gap") blocks.pop();
  return blocks;
}

// ---- Documents ----

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

// What the app can show. Word is .docx only (the old .doc format can't be shown); PDFs and images also work.
export const DOCUMENT_TYPES = {
  pdf: { kind: "pdf", label: "PDF", mime: "application/pdf" },
  docx: { kind: "docx", label: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  png: { kind: "image", label: "Image", mime: "image/png" },
  jpg: { kind: "image", label: "Image", mime: "image/jpeg" },
  jpeg: { kind: "image", label: "Image", mime: "image/jpeg" },
  webp: { kind: "image", label: "Image", mime: "image/webp" },
  gif: { kind: "image", label: "Image", mime: "image/gif" },
};
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_TYPES).map((e) => "." + e).join(",");

export function fileExtension(fileName) {
  const m = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

// null when the app can't show this file type
export function documentType(fileName) {
  return DOCUMENT_TYPES[fileExtension(fileName)] || null;
}

// "" when fine, otherwise the reason it can't be uploaded.
export function validateUpload(file) {
  if (!file) return "Choose a file first.";
  if (fileExtension(file.name) === "doc") return "Old .doc files can't be shown in the app. Save it as .docx or PDF and upload that.";
  if (!documentType(file.name)) return "Upload a PDF, Word (.docx) or image file.";
  if (file.size > MAX_DOCUMENT_BYTES) return `"${file.name}" is too large (max 25MB).`;
  return "";
}

// A starting title from a file name: "Halloween menu v2.docx" -> "Halloween menu v2"
export function titleFromFileName(fileName) {
  return String(fileName || "").replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").trim();
}
