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
    finalUrl: r.final_url || "", // legacy pasted link; the final media is now picked from the library
    finalMediaId: r.final_media_id || "",
    aiImagesAllowed: !!r.ai_images_allowed,
    blogText: r.blog_text || "", // legacy typed-in text
    blogDocUrl: r.blog_doc_url || "",
    sqsCategories: r.sqs_categories || [],
    sqsTags: r.sqs_tags || [],
    seoTitle: r.seo_title || "",
    seoDescription: r.seo_description || "",
    crossLinks: r.cross_links || "",
    pinCategories: r.pin_categories || [],
    pinBoardPrimary: r.pin_board_primary || "",
    pinBoardsSecondary: r.pin_boards_secondary || [],
    pinDescription: r.pin_description || "",
    pinTitle: r.pin_title || "",
    pinLink: r.pin_link || "",
    pinTopics: r.pin_topics || [],
    pinAltText: r.pin_alt_text || "",
    musicAudio: r.music_audio || "",
    pollEnabled: !!r.poll_enabled,
    pollQuestion: r.poll_question || "",
    pollOptions: r.poll_options || [],
    stickerEnabled: !!r.sticker_enabled,
    stickerType: r.sticker_type || "",
    stickerDetails: r.sticker_details && typeof r.sticker_details === "object" && !Array.isArray(r.sticker_details) ? r.sticker_details : {},
    metrics: r.metrics && typeof r.metrics === "object" ? r.metrics : {},
    metricsUpdatedOn: r.metrics_updated_on || "",
    attachments: Array.isArray(r.attachments) ? r.attachments.map((a, i) => ({ id: a.id || `att-${i}`, label: a.label || "", url: a.url || "" })) : [],
    notes: r.notes || "",
    tags: r.tags || [],
    campaignId: r.campaign_id || "",
    calendarEventId: r.calendar_event_id || null,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

// Trims text values and drops empty ones, so the saved details only hold what was filled in.
function cleanStickerDetails(d) {
  const out = {};
  Object.entries(d || {}).forEach(([k, v]) => {
    if (Array.isArray(v)) { const list = v.map((x) => String(x).trim()).filter(Boolean); if (list.length) out[k] = list; }
    else if (String(v ?? "").trim()) out[k] = String(v).trim();
  });
  return out;
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
    final_media_id: p.finalMediaId || null,
    ai_images_allowed: !!p.aiImagesAllowed,
    blog_text: p.blogText || null,
    blog_doc_url: p.blogDocUrl || null,
    sqs_categories: p.sqsCategories || [],
    sqs_tags: p.sqsTags || [],
    seo_title: p.seoTitle || null,
    seo_description: p.seoDescription || null,
    cross_links: p.crossLinks || null,
    pin_categories: p.pinCategories || [],
    pin_board_primary: p.pinBoardPrimary || null,
    pin_boards_secondary: p.pinBoardsSecondary || [],
    pin_description: p.pinDescription || null,
    pin_title: p.pinTitle || null,
    pin_link: p.pinLink || null,
    pin_topics: (p.pinTopics || []).slice(0, 10),
    pin_alt_text: p.pinAltText || null,
    music_audio: p.musicAudio || null,
    poll_enabled: !!p.pollEnabled,
    poll_question: p.pollQuestion || null,
    poll_options: (p.pollOptions || []).map((o) => o.trim()).filter(Boolean),
    sticker_enabled: !!p.stickerEnabled && !!p.stickerType,
    sticker_type: p.stickerEnabled && p.stickerType ? p.stickerType : null,
    sticker_details: p.stickerEnabled && p.stickerType ? cleanStickerDetails(p.stickerDetails) : {},
    metrics: p.metrics || {},
    metrics_updated_on: p.metricsUpdatedOn || null,
    attachments: (p.attachments || []).filter((a) => a.label.trim() || a.url.trim()).map((a) => ({ id: a.id, label: a.label.trim(), url: a.url.trim() })),
    notes: p.notes || null,
    tags: p.tags || [],
    campaign_id: p.campaignId || null,
  };
}

function keywordFromRow(r) {
  return { id: r.id, postId: r.post_id, keyword: r.keyword, impressions: r.impressions ?? "", clicks: r.clicks ?? "", ctr: r.ctr ?? "", avgPosition: r.avg_position ?? "" };
}

function unitFromRow(r) {
  return { id: r.id, postId: r.post_id, sortOrder: r.sort_order || 0, textOverlay: r.text_overlay || "", script: r.script || "", editingNotes: r.editing_notes || "", finalUrl: r.final_url || "", finalMediaId: r.final_media_id || "" };
}

function shotFromRow(r) {
  return {
    id: r.id,
    postId: r.post_id,
    unitId: r.unit_id || null,
    description: r.description,
    mediaType: r.media_type || "",
    aspectRatio: r.aspect_ratio || "",
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

export async function fetchKeywords() {
  const { data, error } = await supabase.from("post_keywords").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(keywordFromRow);
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
export async function savePost(post, units, shots, removed, isNew, originalLinks = {}, extras = { keywords: [], removedKeywordIds: [] }) {
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
    const rows = units.map((u, i) => ({ id: u.id, post_id: post.id, sort_order: i, text_overlay: u.textOverlay || null, script: u.script || null, editing_notes: u.editingNotes || null, final_url: u.finalUrl || null, final_media_id: u.finalMediaId || null }));
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
      aspect_ratio: s.aspectRatio || null,
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
  if (extras.removedKeywordIds.length > 0) {
    const { error } = await supabase.from("post_keywords").delete().in("id", extras.removedKeywordIds);
    if (error) throw error;
  }
  if (extras.keywords.length > 0) {
    const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    const rows = extras.keywords.map((k) => {
      const impressions = num(k.impressions);
      const clicks = num(k.clicks);
      let ctr = num(k.ctr);
      if (ctr === null && impressions > 0 && clicks !== null) ctr = Math.round((clicks / impressions) * 10000) / 100; // click rate in percent
      return { id: k.id, post_id: post.id, keyword: k.keyword.trim(), impressions, clicks, ctr, avg_position: num(k.avgPosition), period_days: 30 };
    });
    const { error } = await supabase.from("post_keywords").upsert(rows);
    if (error) throw error;
  }
}

export async function setPostStatus(id, status) {
  const { error } = await supabase.from("posts").update({ status }).eq("id", id);
  if (error) throw error;
}

// Moves a post to another day. The time is left exactly as it was.
export async function setPostDate(id, publishDate) {
  const { error } = await supabase.from("posts").update({ publish_date: publishDate }).eq("id", id);
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
export const subscribeKeywords = (cb) => subscribeTable("post_keywords", cb);

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
