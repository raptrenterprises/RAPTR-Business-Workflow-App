export const MEDIA_TYPES = [
  { value: "photo", label: "Photo" },
  { value: "video", label: "Video" },
];
export const ASSET_KINDS = [
  { value: "raw", label: "Raw (unedited)" },
  { value: "finished", label: "Finished post" },
];
export const POST_FORMATS = ["Reel", "Carousel", "Image post", "Story", "Pinterest pin", "Blog thumbnail", "Other"];
export const MEDIA_PEOPLE = ["Cathy", "Evan", "Product", "Food/Cocktail", "Text only", "Other"];

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
  "Image post": { caption: true, seeders: true, poll: true, overlay: true, shots: "single", shotLabel: "Shot list item", finalLabel: "Final edited image (link)", manual: true },
  Story: { poll: true, music: true, overlay: true, shots: "single", shotLabel: "Shot list item", finalLabel: "Final edited image (link)", manual: true },
  Carousel: { caption: true, seeders: true, poll: true, music: true, units: "slide", manual: true },
  Reel: { caption: true, seeders: true, poll: true, music: true, units: "beat", finalLabel: "Final edited video (link)", manual: true },
  "Blog post": { blog: true, shots: "single", shotLabel: "Thumbnail (shot list item)", finalLabel: "Thumbnail image (link)" },
  "Pinterest pin": { overlay: true, pin: true, shots: "single", shotLabel: "Shot list item", finalLabel: "Final edited image (link)" },
  Other: { shots: "multi", shotLabel: "Shot list items", attachments: true },
};
// Only posts with seeder comments get an auto-created calendar event.
export const CALENDAR_TYPES = ["Image post", "Reel", "Carousel"];
export const createsCalendarEvent = (postType) => CALENDAR_TYPES.includes(postType);
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

// ---- Pinterest ----
export const PIN_BOARDS = [
  "Wedding Weekend Activities",
  "Murder Mystery Party Ideas",
  "Dinner Party Games & Hosting Tips",
  "Hosting Tips & Party Planning",
  "RAPTR Mysteries: Behind the Scenes",
  "Dinner Party Recipe & Food Inspiration",
  "Bachelorette & Group Party Ideas",
  "Cocktail Recipes & Party Drinks",
  "Character Reels & Roleplay Inspiration",
  "Gift Ideas",
];
export const PIN_TOPICS = [
  "french wedding", "destination wedding", "wedding reception", "wedding afterparty", "wedding games", "engagement party",
  "bridal shower games", "bachelorette party", "couple games", "unsolved mystery", "murder mystery", "murder mystery party",
  "party games", "dinner party", "disco party", "halloween games", "group games", "indoor games", "birthday games",
  "role playing games", "cocktail recipes",
];
export const PIN_TOPICS_MAX = 10;

// ---- Performance metrics (entered by hand once a post is Live) ----
// Instagram's current Insights metrics: "views" replaced "impressions" in 2025. Story taps/exits and
// sticker/link taps are read from the Instagram app's story insights.
const IG_FEED = [
  { key: "views", label: "Views" }, { key: "reach", label: "Reach (accounts)" }, { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" }, { key: "shares", label: "Shares" }, { key: "saves", label: "Saves" },
  { key: "total_interactions", label: "Total interactions" }, { key: "profile_visits", label: "Profile visits" }, { key: "follows", label: "Follows" },
];
const IG_REEL = [
  { key: "views", label: "Views (plays)" }, { key: "reach", label: "Reach (accounts)" }, { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" }, { key: "shares", label: "Shares" }, { key: "saves", label: "Saves" },
  { key: "total_interactions", label: "Total interactions" }, { key: "avg_watch_time_s", label: "Average watch time (seconds)" },
  { key: "total_watch_time_s", label: "Total watch time (seconds)" }, { key: "skip_rate_pct", label: "Skip rate (%)" }, { key: "profile_visits", label: "Profile visits" },
];
const IG_STORY = [
  { key: "views", label: "Views" }, { key: "reach", label: "Reach (accounts)" }, { key: "replies", label: "Replies" }, { key: "shares", label: "Shares" },
  { key: "taps_forward", label: "Taps forward" }, { key: "taps_back", label: "Taps back" }, { key: "next_story", label: "Next story swipes" }, { key: "exits", label: "Exits" },
  { key: "profile_visits", label: "Profile visits" }, { key: "follows", label: "Follows" }, { key: "link_taps", label: "Link sticker taps" }, { key: "sticker_taps", label: "Other sticker taps" },
];
const PIN = [
  { key: "impressions", label: "Impressions" }, { key: "saves", label: "Saves" }, { key: "save_rate_pct", label: "Save rate (%)" },
  { key: "pin_clicks", label: "Pin clicks (closeups)" }, { key: "outbound_clicks", label: "Outbound clicks" },
  { key: "engagements", label: "Engagements" }, { key: "engagement_rate_pct", label: "Engagement rate (%)" },
];
const PIN_VIDEO = [
  { key: "video_views", label: "Video views (MRC)" }, { key: "video_10s_views", label: "10-second views" }, { key: "video_95_views", label: "95% views" },
  { key: "video_avg_watch_time_s", label: "Average watch time (seconds)" }, { key: "video_play_time_s", label: "Total play time (seconds)" },
];
export const METRICS_BY_TYPE = {
  "Image post": { groups: [{ title: "Instagram", fields: IG_FEED }] },
  Carousel: { groups: [{ title: "Instagram", fields: IG_FEED }] },
  Reel: { groups: [{ title: "Instagram", fields: IG_REEL }] },
  Story: { groups: [{ title: "Instagram", fields: IG_STORY }] },
  "Pinterest pin": { groups: [{ title: "Pinterest", fields: PIN }, { title: "Video pins only", fields: PIN_VIDEO }] },
  "Blog post": { groups: [{ title: "Blog", fields: [{ key: "page_views_30d", label: "Page views (30 days)" }] }], keywords: true },
};

// ---- Colors ----
// Posts are colored by TYPE (the format); the status chips keep their own stage colors.
export const TYPE_COLOR = {
  Reel: "#B5446E",
  Carousel: "#2F6F8F",
  "Image post": "#7A5C99",
  Story: "#D17A22",
  "Pinterest pin": "#C0392B",
  "Blog post": "#4B7F52",
  Other: "#6B7280",
};
export const typeColor = (postType) => TYPE_COLOR[postType] || TYPE_COLOR.Other;
// Calendar text color by status: scheduled/live green; drafted/edited/ready to post blue; idea/planned/filmed orange.
export const STATUS_TEXT_COLOR = { scheduled: "#2E7D32", live: "#2E7D32", drafted: "#1F5FBF", edited: "#1F5FBF", ready_to_post: "#1F5FBF", idea: "#C26A00", planned: "#C26A00", filmed: "#C26A00" };
