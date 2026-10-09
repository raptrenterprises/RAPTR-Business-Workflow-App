import { supabase } from "./supabaseClient";

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    mediaType: r.media_type || "photo",
    assetKind: r.asset_kind || "raw",
    postFormat: r.post_format || "",
    sourceUrl: r.source_url || "",
    fileName: r.file_name || "",
    subfolder: r.subfolder || "",
    mediaNumber: r.media_number ?? null,
    onedriveItemId: r.onedrive_item_id || "",
    thumbnailUrl: r.thumbnail_url || "",
    thumbnailPath: r.thumbnail_path || "",
    isAi: !!r.is_ai,
    aspectRatio: r.aspect_ratio || "",
    width: r.width ?? null,
    height: r.height ?? null,
    people: r.people || [],
    tags: r.tags || [],
    shotDate: r.shot_date || "",
    notes: r.notes || "",
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

function toRow(m) {
  return {
    title: m.title,
    media_type: m.mediaType,
    asset_kind: m.assetKind,
    post_format: m.assetKind === "finished" ? m.postFormat || null : null,
    source_url: m.sourceUrl || null,
    file_name: m.fileName || null,
    subfolder: m.subfolder ? m.subfolder : null,
    onedrive_item_id: m.onedriveItemId || null,
    thumbnail_url: m.thumbnailUrl || null,
    thumbnail_path: m.thumbnailPath || null,
    is_ai: !!m.isAi,
    aspect_ratio: m.aspectRatio || null,
    width: m.width || null,
    height: m.height || null,
    people: m.people || [],
    tags: m.tags || [],
    shot_date: m.shotDate || null,
    notes: m.notes || null,
  };
}

export async function fetchMedia() {
  const { data, error } = await supabase
    .from("media_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data.map(fromRow);
}

export async function insertMedia(m) {
  const { error } = await supabase.from("media_items").insert({
    id: m.id,
    ...toRow(m),
    created_by: m.createdBy,
    created_at: m.createdAt,
  });
  if (error) throw error;
}

export async function updateMedia(id, m) {
  const { error } = await supabase.from("media_items").update(toRow(m)).eq("id", id);
  if (error) throw error;
}

export async function deleteMediaRow(id) {
  const { error } = await supabase.from("media_items").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeMedia(onChange) {
  const channel = supabase
    .channel(`media-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "media_items" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Several items at once (the bulk add). Each row is a full media item with its own id.
export async function insertMediaBatch(items) {
  const rows = items.map((m) => ({ id: m.id, ...toRow(m), created_by: m.createdBy, created_at: m.createdAt }));
  const { error } = await supabase.from("media_items").insert(rows);
  if (error) throw error;
}

// Where each collection's files live: { raw: { baseUrl, linkStyle }, edited: { ... } }.
export async function fetchLocations() {
  const { data, error } = await supabase.from("media_locations").select("*");
  if (error) throw error;
  const out = { raw: { baseUrl: "", linkStyle: "folder" }, edited: { baseUrl: "", linkStyle: "folder" } };
  data.forEach((r) => { out[r.collection] = { baseUrl: r.base_url || "", linkStyle: r.link_style || "folder" }; });
  return out;
}

export async function saveLocation(collection, baseUrl, linkStyle) {
  const { error } = await supabase.from("media_locations").upsert({ collection, base_url: baseUrl || null, link_style: linkStyle, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export function subscribeLocations(onChange) {
  const channel = supabase
    .channel(`media-locations-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "media_locations" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
