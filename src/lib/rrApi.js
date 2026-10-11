import { supabase } from "./supabaseClient";
import { documentType, fileExtension } from "./rrLogic";

const BUCKET = "rr-documents"; // private: files are only reachable while signed in

// ---- Holidays ----
function holidayFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    requiredElements: r.required_elements || "",
    anniversaryNotes: r.anniversary_notes || "",
    firstYear: r.first_year,
  };
}

export async function fetchHolidays() {
  const { data, error } = await supabase.from("rr_holidays").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return data.map(holidayFromRow);
}

export async function saveHoliday(id, { requiredElements, anniversaryNotes, firstYear }) {
  const { error } = await supabase.from("rr_holidays").update({
    required_elements: requiredElements,
    anniversary_notes: anniversaryNotes,
    first_year: firstYear,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

// ---- Documents ----
function documentFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    fileName: r.file_name,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    size: r.size_bytes,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

export async function fetchDocuments() {
  const { data, error } = await supabase.from("rr_documents").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(documentFromRow);
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Uploads the file, then records its title. If recording fails, the file is removed again so nothing is orphaned.
export async function uploadDocument(file, title, uploadedBy) {
  const type = documentType(file.name);
  const path = `${newId()}.${fileExtension(file.name)}`;
  // Send the content type ourselves: some phones report an empty type for .docx.
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type.mime, upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase.from("rr_documents").insert({
    title: title.trim(), file_name: file.name, storage_path: path, mime_type: type.mime, size_bytes: file.size, uploaded_by: uploadedBy || null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function renameDocument(id, title) {
  const { error } = await supabase.from("rr_documents").update({ title: title.trim() }).eq("id", id);
  if (error) throw error;
}

// Removes the record first, then the file. If the file removal fails the record is already gone, so nothing shows.
export async function deleteDocument(doc) {
  const { error } = await supabase.from("rr_documents").delete().eq("id", doc.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([doc.storagePath]);
}

// The file itself, fetched through your sign-in (there is no public link).
export async function downloadDocumentBlob(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw error;
  return data;
}

function subscribe(table, onChange) {
  const channel = supabase
    .channel(`${table}-changes-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
export const subscribeHolidays = (onChange) => subscribe("rr_holidays", onChange);
export const subscribeDocuments = (onChange) => subscribe("rr_documents", onChange);
