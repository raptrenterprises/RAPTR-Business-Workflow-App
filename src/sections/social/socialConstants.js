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

// Which fields each post type uses. Everything not listed here (status, campaign,
// date/time, idea overview, tags, notes) is common to all types.
//   units: "slide" | "beat"  -> a dynamic, reorderable list, each with its own fields/shots
//   shots: "single" | "multi" -> shot list item(s) on the post itself (when there are no units)
export const TYPE_CONFIG = {
  "Image post": { caption: true, seeders: true, overlay: true, shots: "single", shotLabel: "Shot list item", finalLabel: "Final edited image (link)", manual: true },
  Story: { overlay: true, shots: "single", shotLabel: "Shot list item", finalLabel: "Final edited image (link)", manual: true },
  Carousel: { caption: true, seeders: true, units: "slide", manual: true },
  Reel: { caption: true, seeders: true, units: "beat", finalLabel: "Final edited video (link)", manual: true },
  "Blog post": { blog: true, shots: "single", shotLabel: "Thumbnail (shot list item)", finalLabel: "Thumbnail image (link)" },
  "Pinterest pin": { overlay: true, pin: true, shots: "single", shotLabel: "Shot list item", finalLabel: "Final edited image (link)" },
  Other: { shots: "multi", shotLabel: "Shot list items", attachments: true },
};
export const typeConfig = (postType) => TYPE_CONFIG[postType] || TYPE_CONFIG.Other;
export const UNIT_DEFAULT_COUNT = { slide: 3, beat: 3 };
export const UNIT_NOUN = { slide: "Slide", beat: "Beat" };

export const SEEDER_FIELDS = [
  { key: "seederRaptr", label: "Initial seeder comment (RAPTR)" },
  { key: "seederEvan", label: "Seeder comment (Evan)" },
  { key: "seederEvanReply", label: "Seeder comment (reply to Evan)" },
  { key: "seederCathy", label: "Seeder comment (Cathy)" },
  { key: "seederCathyReply", label: "Seeder comment (reply to Cathy)" },
];

// Status flow per post type. Blog posts are drafted rather than filmed. Image posts,
// reels, carousels, and stories can also go to "ready to manually post" instead of
// "scheduled" (for posts that can't be pre-scheduled).
const DEFAULT_FLOW = ["idea", "planned", "filmed", "edited", "scheduled", "live"];
const BLOG_FLOW = ["idea", "planned", "drafted", "edited", "scheduled", "live"];
export function statusFlow(postType) {
  if (postType === "Blog post") return BLOG_FLOW;
  if (typeConfig(postType).manual) return ["idea", "planned", "filmed", "edited", "scheduled", "ready_to_post", "live"];
  return DEFAULT_FLOW;
}
// The status options you can move to next (two at "edited" for manual-capable types).
export function nextStatuses(postType, status) {
  if (status === "live") return [];
  if (status === "scheduled" || status === "ready_to_post") return ["live"];
  const base = statusFlow(postType).filter((s) => s !== "ready_to_post");
  const i = base.indexOf(status);
  if (i < 0 || i >= base.length - 1) return [];
  const next = base[i + 1];
  return next === "scheduled" && typeConfig(postType).manual ? ["scheduled", "ready_to_post"] : [next];
}
// When a post's type changes, keep its status valid for the new flow.
export function normalizeStatus(postType, status) {
  const flow = statusFlow(postType);
  if (flow.includes(status)) return status;
  if (status === "filmed" && flow.includes("drafted")) return "drafted";
  if (status === "drafted" && flow.includes("filmed")) return "filmed";
  if (status === "ready_to_post") return "scheduled";
  return flow[0];
}
export const isOnCalendarStatus = (status) => status === "scheduled" || status === "ready_to_post";
export const STATUS_LABEL = { idea: "Idea", planned: "Planned", filmed: "Filmed", drafted: "Drafted", edited: "Edited", scheduled: "Scheduled", ready_to_post: "Ready to manually post", live: "Live" };
export const STATUS_COLOR = { idea: "#5A5A5A", planned: "#3B6E8F", filmed: "#6B4E8E", drafted: "#6B4E8E", edited: "#B8860B", scheduled: "#C1562E", ready_to_post: "#2E7D8C", live: "#3E6B4F" };
export const SHOT_MEDIA_TYPES = [{ value: "", label: "Photo or video" }, { value: "photo", label: "Photo" }, { value: "video", label: "Video" }];

export function formatPostDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
