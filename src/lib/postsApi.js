import { supabase } from "./supabaseClient";

function postFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    postType: r.post_type || "Other",
    status: r.status || "idea",
    publishDate: r.publish_date || "",
    publishTime: r.publish_time ? r.publish_time.slice(0, 5) : "",
    caption: r.caption || "",
    seederComments: r.seeder_comments || "",
    textOverlay: r.text_overlay || "",
    notes: r.notes || "",
    tags: r.tags || [],
    campaignId: r.campaign_id || "",
    calendarEventId: r.calendar_event_id || null,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

function postToRow(p) {
  return {
    title: p.title,
    post_type: p.postType,
    status: p.status,
    publish_date: p.publishDate || null,
    publish_time: p.publishTime || null,
    caption: p.caption || null,
    seeder_comments: p.seederComments || null,
    text_overlay: p.textOverlay || null,
    notes: p.notes || null,
    tags: p.tags || [],
    campaign_id: p.campaignId || null,
  };
}

function shotFromRow(r) {
  return {
    id: r.id,
    postId: r.post_id,
    description: r.description,
    mediaType: r.media_type || "",
    people: r.people || [],
    tags: r.tags || [],
    completed: r.completed,
    sortOrder: r.sort_order || 0,
  };
}

function campaignFromRow(r) {
  return { id: r.id, name: r.name, description: r.description || "", notes: r.notes || "", createdBy: r.created_by, createdAt: r.created_at };
}

export async function fetchPosts() {
  const { data, error } = await supabase.from("posts").select("*").order("publish_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data.map(postFromRow);
}

export async function fetchShotItems() {
  const { data, error } = await supabase.from("shot_items").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return data.map(shotFromRow);
}

export async function fetchShotMedia() {
  const { data, error } = await supabase.from("shot_item_media").select("shot_item_id, media_id");
  if (error) throw error;
  return data.map((r) => ({ shotItemId: r.shot_item_id, mediaId: r.media_id }));
}

export async function fetchCampaigns() {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(campaignFromRow);
}

// Saves a post and its shot list together. Order matters: the post row goes
// first (shots reference it), and shots go last so the database's
// "all shots done -> Filmed" rule sees the final state.
export async function savePost(post, shots, removedShotIds, isNew, originalLinks = {}) {
  if (isNew) {
    const { error } = await supabase.from("posts").insert({ id: post.id, ...postToRow(post), created_by: post.createdBy, created_at: post.createdAt });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("posts").update(postToRow(post)).eq("id", post.id);
    if (error) throw error;
  }
  if (removedShotIds.length > 0) {
    const { error } = await supabase.from("shot_items").delete().in("id", removedShotIds);
    if (error) throw error;
  }
  if (shots.length > 0) {
    const rows = shots.map((s, i) => ({
      id: s.id,
      post_id: post.id,
      description: s.description.trim(),
      media_type: s.mediaType || null,
      people: s.people || [],
      tags: s.tags || [],
      completed: !!s.completed,
      sort_order: i,
    }));
    const { error } = await supabase.from("shot_items").upsert(rows);
    if (error) throw error;
  }
  // Media links last: the database marks a shot complete when it gains a link
  // (and incomplete when it loses its last one), which can then move the post to Filmed.
  const toAdd = [];
  for (const s of shots) {
    const before = originalLinks[s.id] || [];
    const now = s.mediaIds || [];
    now.filter((m) => !before.includes(m)).forEach((m) => toAdd.push({ shot_item_id: s.id, media_id: m }));
    const gone = before.filter((m) => !now.includes(m));
    if (gone.length > 0) {
      const { error } = await supabase.from("shot_item_media").delete().eq("shot_item_id", s.id).in("media_id", gone);
      if (error) throw error;
    }
  }
  if (toAdd.length > 0) {
    const { error } = await supabase.from("shot_item_media").upsert(toAdd, { onConflict: "shot_item_id,media_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

export async function setPostStatus(id, status) {
  const { error } = await supabase.from("posts").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setPostCampaign(id, campaignId) {
  const { error } = await supabase.from("posts").update({ campaign_id: campaignId || null }).eq("id", id);
  if (error) throw error;
}

export async function deletePostRow(id) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function insertCampaign(c) {
  const { error } = await supabase.from("campaigns").insert({ id: c.id, name: c.name, description: c.description || null, notes: c.notes || null, created_by: c.createdBy, created_at: c.createdAt });
  if (error) throw error;
}

export async function updateCampaign(id, c) {
  const { error } = await supabase.from("campaigns").update({ name: c.name, description: c.description || null, notes: c.notes || null }).eq("id", id);
  if (error) throw error;
}

export async function deleteCampaignRow(id) {
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

function subscribeTable(table, onChange) {
  const channel = supabase
    .channel(`${table}-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
export const subscribePosts = (cb) => subscribeTable("posts", cb);
export const subscribeShotItems = (cb) => subscribeTable("shot_items", cb);
export const subscribeCampaigns = (cb) => subscribeTable("campaigns", cb);
export const subscribeShotMedia = (cb) => subscribeTable("shot_item_media", cb);

export async function setShotCompleted(id, completed) {
  const { error } = await supabase.from("shot_items").update({ completed }).eq("id", id);
  if (error) throw error;
}

// Replaces one shot's linked media. The database marks the shot complete when it
// has at least one link (and incomplete again when the last link is removed).
export async function setShotMediaLinks(shotId, mediaIds, previousIds) {
  const gone = previousIds.filter((m) => !mediaIds.includes(m));
  const added = mediaIds.filter((m) => !previousIds.includes(m));
  if (gone.length > 0) {
    const { error } = await supabase.from("shot_item_media").delete().eq("shot_item_id", shotId).in("media_id", gone);
    if (error) throw error;
  }
  if (added.length > 0) {
    const { error } = await supabase.from("shot_item_media").upsert(added.map((m) => ({ shot_item_id: shotId, media_id: m })), { onConflict: "shot_item_id,media_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}
