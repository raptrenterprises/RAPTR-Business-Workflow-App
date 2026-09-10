import { supabase } from "./supabaseClient";

const BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB — generous for a 2-person app, keeps mobile uploads sane

// Uploads a single file under the given folder (e.g. `tasks/{taskId}`,
// `events/{eventId}`, `threads/{threadId}/{messageId}`) and returns the
// metadata object the app stores alongside the task/event/message.
export async function uploadAttachment(file, folder, uploadedBy) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is too large (max 25MB).`);
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    name: file.name,
    path,
    url: data.publicUrl,
    size: file.size,
    type: file.type || "",
    uploadedBy: uploadedBy || null,
    uploadedAt: new Date().toISOString(),
  };
}

// Best-effort delete — callers should still remove the attachment from
// whatever list references it even if this throws (e.g. already gone).
export async function deleteAttachment(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export function formatFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
