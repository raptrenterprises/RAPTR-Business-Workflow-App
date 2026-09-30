export const MEDIA_TYPES = [
  { value: "photo", label: "Photo" },
  { value: "video", label: "Video" },
];
export const ASSET_KINDS = [
  { value: "raw", label: "Raw (unedited)" },
  { value: "finished", label: "Finished post" },
];
export const POST_FORMATS = ["Reel", "Carousel", "Image post", "Story", "Pinterest pin", "Blog thumbnail", "Other"];
export const MEDIA_PEOPLE = ["Cathy", "Evan", "Product", "Other"];

// Tags are stored lowercase and trimmed so "Flatlay" and "flatlay " can't become two tags.
export function normalizeTag(t) {
  return String(t || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ---- Post planning ----
export const POST_TYPES = ["Reel", "Carousel", "Image post", "Story", "Pinterest pin", "Blog post", "Other"];

// Status flow per post type. Blog posts are drafted rather than filmed.
const DEFAULT_FLOW = ["idea", "planned", "filmed", "edited", "scheduled", "live"];
const BLOG_FLOW = ["idea", "planned", "drafted", "edited", "scheduled", "live"];
export function statusFlow(postType) {
  return postType === "Blog post" ? BLOG_FLOW : DEFAULT_FLOW;
}
export function nextStatus(postType, status) {
  const flow = statusFlow(postType);
  const i = flow.indexOf(status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}
// When a post's type changes, keep its status valid for the new flow (filmed <-> drafted).
export function normalizeStatus(postType, status) {
  const flow = statusFlow(postType);
  if (flow.includes(status)) return status;
  if (status === "filmed" && flow.includes("drafted")) return "drafted";
  if (status === "drafted" && flow.includes("filmed")) return "filmed";
  return flow[0];
}
export const STATUS_LABEL = { idea: "Idea", planned: "Planned", filmed: "Filmed", drafted: "Drafted", edited: "Edited", scheduled: "Scheduled", live: "Live" };
export const STATUS_COLOR = { idea: "#5A5A5A", planned: "#3B6E8F", filmed: "#6B4E8E", drafted: "#6B4E8E", edited: "#B8860B", scheduled: "#C1562E", live: "#3E6B4F" };
export const SHOT_MEDIA_TYPES = [{ value: "", label: "Photo or video" }, { value: "photo", label: "Photo" }, { value: "video", label: "Video" }];

export function formatPostDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
