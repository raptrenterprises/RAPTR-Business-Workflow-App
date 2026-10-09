// Aspect ratios: the choices offered on shot list items, the default for each post type,
// and a helper that turns a file's pixel size into the nearest standard ratio.

// Portrait first (most of what RAPTR posts), then square and landscape.
export const ASPECT_RATIOS = ["9:16", "4:5", "3:4", "2:3", "1:1", "3:2", "4:3", "5:4", "16:9", "1.91:1"];

// Default for each post type's shot list items. "Other" has no default (blank = any).
export const POST_TYPE_ASPECT = {
  "Image post": "3:4",
  Carousel: "3:4",
  Story: "9:16",
  Reel: "9:16",
  "Blog post": "3:2",
  "Pinterest pin": "2:3",
};
export const defaultAspectRatio = (postType) => POST_TYPE_ASPECT[postType] || "";

const value = (label) => {
  const [a, b] = label.split(":").map(Number);
  return a / b;
};

// The nearest standard ratio if the file is within 3% of one; otherwise a plain "1.43:1" style label,
// so an odd-sized image still gets a truthful value instead of being forced into the wrong box.
export function describeRatio(width, height) {
  if (!width || !height) return "";
  const r = width / height;
  let best = "";
  let bestDiff = Infinity;
  ASPECT_RATIOS.forEach((label) => {
    const diff = Math.abs(r - value(label)) / value(label);
    if (diff < bestDiff) { best = label; bestDiff = diff; }
  });
  if (bestDiff <= 0.03) return best;
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

// Does a media item's ratio match what a shot wants? Unknown on either side counts as "no opinion".
export function ratiosMatch(want, have) {
  if (!want || !have) return true;
  return want === have;
}
