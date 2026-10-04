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
    onedriveItemId: r.onedrive_item_id || "",
    thumbnailUrl: r.thumbnail_url || "",
    thumbnailPath: r.thumbnail_path || "",
    isAi: !!r.is_ai,
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
    onedrive_item_id: m.onedriveItemId || null,
    thumbnail_url: m.thumbnailUrl || null,
    thumbnail_path: m.thumbnailPath || null,
    is_ai: !!m.isAi,
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
