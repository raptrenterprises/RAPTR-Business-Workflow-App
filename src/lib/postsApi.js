import { supabase } from "./supabaseClient";

function postFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    postType: r.post_type || "Other",
    status: r.status || "idea",
    publishDate: r.publish_date || "",
    publishTime: r.publish_time ? r.publish_time.slice(0, 5) : "",
    description: r.description || "",
    caption: r.caption || "",
    seederComments: r.seeder_comments || "", // legacy free-text comments (imported posts)
    seederRaptr: r.seeder_raptr || "",
    seederEvan: r.seeder_evan || "",
    seederEvanReply: r.seeder_evan_reply || "",
    seederCathy: r.seeder_cathy || "",
    seederCathyReply: r.seeder_cathy_reply || "",
    textOverlay: r.text_overlay || "",
    finalUrl: r.final_url || "",
    blogText: r.blog_text || "",
    sqsCategories: r.sqs_categories || [],
    sqsTags: r.sqs_tags || [],
    crossLinks: r.cross_links || "",
    pinCategories: r.pin_categories || [],
    pinBoards: r.pin_boards || [],
    pinDescription: r.pin_description || "",
    attachments: Array.isArray(r.attachments) ? r.attachments.map((a, i) => ({ id: a.id || `att-${i}`, label: a.label || "", url: a.url || "" })) : [],
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
    description: p.description || null,
    caption: p.caption || null,
    seeder_comments: p.seederComments || null,
    seeder_raptr: p.seederRaptr || null,
    seeder_evan: p.seederEvan || null,
    seeder_evan_reply: p.seederEvanReply || null,
    seeder_cathy: p.seederCathy || null,
    seeder_cathy_reply: p.seederCathyReply || null,
    text_overlay: p.textOverlay || null,
    final_url: p.finalUrl || null,
    blog_text: p.blogText || null,
    sqs_categories: p.sqsCategories || [],
    sqs_tags: p.sqsTags || [],
    cross_links: p.crossLinks || null,
    pin_categories: p.pinCategories || [],
    pin_boards: p.pinBoards || [],
    pin_description: p.pinDescription || null,
    attachments: (p.attachments || []).filter((a) => a.label.trim() || a.url.trim()).map((a) => ({ id: a.id, label: a.label.trim(), url: a.url.trim() })),
    notes: p.notes || null,
    tags: p.tags || [],
    campaign_id: p.campaignId || null,
  };
}

function unitFromRow(r) {
  return { id: r.id, postId: r.post_id, sortOrder: r.sort_order || 0, textOverlay: r.text_overlay || "", script: r.script || "", editingNotes: r.editing_notes || "", finalUrl: r.final_url || "" };
}

function shotFromRow(r) {
  return {
    id: r.id,
    postId: r.post_id,
    unitId: r.unit_id || null,
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

export async function fetchUnits() {
  const { data, error } = await supabase.from("post_units").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return data.map(unitFromRow);
}

export async function fetchCampaigns() {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(campaignFromRow);
}

// Saves a post with its slides/beats and shot list together. Order matters: the post
// row first, then removed units/shots, then units (shots may point at them), then
// shots, and media links last so the database's "shot has media -> complete" and
// "all shots done -> Filmed" rules see the final state.
export async function savePost(post, units, shots, removed, isNew, originalLinks = {}) {
  if (isNew) {
    const { error } = await supabase.from("posts").insert({ id: post.id, ...postToRow(post), created_by: post.createdBy, created_at: post.createdAt });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("posts").update(postToRow(post)).eq("id", post.id);
    if (error) throw error;
  }
  if (removed.unitIds.length > 0) {
    const { error } = await supabase.from("post_units").delete().in("id", removed.unitIds);
    if (error) throw error;
  }
  if (removed.shotIds.length > 0) {
    const { error } = await supabase.from("shot_items").delete().in("id", removed.shotIds);
    if (error) throw error;
  }
  if (units.length > 0) {
    const rows = units.map((u, i) => ({ id: u.id, post_id: post.id, sort_order: i, text_overlay: u.textOverlay || null, script: u.script || null, editing_notes: u.editingNotes || null, final_url: u.finalUrl || null }));
    const { error } = await supabase.from("post_units").upsert(rows);
    if (error) throw error;
  }
  if (shots.length > 0) {
    const rows = shots.map((s, i) => ({
      id: s.id,
      post_id: post.id,
      unit_id: s.unitId || null,
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
export const subscribeUnits = (cb) => subscribeTable("post_units", cb);

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
