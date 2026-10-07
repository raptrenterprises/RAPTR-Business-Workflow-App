// Storage-neutral media locations. A media item records WHERE it lives (collection, subfolder,
// file name) and the app builds the link from the base location in media_locations.
// Moving to a different storage later means copying the files and changing those base locations.

// Raw items live in the "raw" folder; finished (edited) items live in the "edited" folder.
export const collectionOf = (assetKind) => (assetKind === "finished" ? "edited" : "raw");

export const cleanSubfolder = (s) => String(s || "").split(/[\\/]+/).map((x) => x.trim()).filter(Boolean).join("/");

// Path inside the collection folder, e.g. "2026-10/PXL_20261003_123456.jpg".
export const mediaPath = (item) => [cleanSubfolder(item.subfolder), item.fileName].filter(Boolean).join("/");

// Where to look for the file, e.g. "raw/2026-10/PXL_20261003_123456.jpg".
export const expectedPath = (item) => `${collectionOf(item.assetKind)}/${mediaPath(item)}`;

// The link to open an item: its own direct link if it has one, otherwise built from the
// collection's base location. "folder" style opens the folder; "path" style builds a file URL.
export function resolveMediaUrl(item, locations) {
  if (item.sourceUrl) return item.sourceUrl;
  const loc = locations?.[collectionOf(item.assetKind)];
  if (!loc || !loc.baseUrl) return "";
  if (loc.linkStyle === "path" && item.fileName) {
    return `${loc.baseUrl.replace(/\/+$/, "")}/${mediaPath(item).split("/").map(encodeURIComponent).join("/")}`;
  }
  return loc.baseUrl;
}

// True when the resolved link goes to the exact file (not just its folder).
export const linksToExactFile = (item, locations) =>
  !!item.sourceUrl || (locations?.[collectionOf(item.assetKind)]?.linkStyle === "path" && !!item.fileName && !!locations?.[collectionOf(item.assetKind)]?.baseUrl);

export const pathKey = (assetKind, subfolder, fileName) => `${assetKind}|${cleanSubfolder(subfolder).toLowerCase()}|${String(fileName || "").toLowerCase()}`;

// Names that phones, browsers, or OneDrive often substitute for the real file name.
export const isGenericName = (name) => /^(image|photo|video|download|blob|trim|unknown|file)( ?\(\d+\))?\.[a-z0-9]+$/i.test(name) || /\(\d+\)\.[a-z0-9]+$/i.test(name);

export const stripExtension = (name) => name.replace(/\.[^.]+$/, "");
