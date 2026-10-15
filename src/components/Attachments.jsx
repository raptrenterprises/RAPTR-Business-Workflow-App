import { useState, useRef } from "react";
import { Paperclip, X, FileText, Download, BookOpen } from "lucide-react";
import { STYLES } from "../constants";
import { uploadAttachment, deleteAttachment, downloadAttachmentText, formatFileSize } from "../lib/storageApi";
import { isMarkdownName } from "../lib/markdown";
import MarkdownModal from "./MarkdownModal";

// The file's name as a link. A Markdown (.md) file opens in the in-app reader instead of a new tab, where it
// would show as raw text full of # and * symbols.
const nameStyle = { color: STYLES.wax, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
function AttachmentName({ a, onRead }) {
  if (isMarkdownName(a.name)) {
    return (
      <button type="button" onClick={() => onRead(a)} title="Read" style={{ ...nameStyle, background: "none", border: "none", padding: 0, font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
        <BookOpen size={12} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline" }}>{a.name}</span>
      </button>
    );
  }
  return <a href={a.url} target="_blank" rel="noopener noreferrer" style={nameStyle}>{a.name}</a>;
}

function Reader({ a, onClose }) {
  return <MarkdownModal title={a.name} load={() => downloadAttachmentText(a.path)} onClose={onClose} />;
}

// Reusable attachment upload + list widget.
//
// `folder` — storage path prefix this entity's files live under, e.g.
//   `tasks/${taskId}`, `events/${eventId}`, `threads/${threadId}/${messageId}`.
// `attachments` — current array of {name, path, url, size, type, uploadedBy, uploadedAt}.
// `onChange(nextArray)` — called after every add/remove. The caller decides
//   whether that means "update local draft state" (new, unsaved entity) or
//   "persist immediately to the DB" (existing entity) — this component
//   doesn't know or care which.
// `uploadedBy` — current user's display name, stamped onto new uploads.
export function AttachmentManager({ folder, attachments, onChange, uploadedBy, compact }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [reading, setReading] = useState(null);
  const inputRef = useRef(null);
  const list = attachments || [];

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setUploadError("");
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadAttachment(file, folder, uploadedBy));
      }
      onChange([...list, ...uploaded]);
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(att) {
    onChange(list.filter((a) => a.path !== att.path));
    try { await deleteAttachment(att.path); } catch { /* file's unlinked either way */ }
  }

  return (
    <div>
      {list.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
          {list.map((a) => (
            <div key={a.path} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: STYLES.ink + "08", borderRadius: 4, padding: "4px 8px" }}>
              <FileText size={13} color={STYLES.slate} style={{ flexShrink: 0 }} />
              <AttachmentName a={a} onRead={setReading} />
              <span style={{ color: STYLES.slate, flexShrink: 0 }}>{formatFileSize(a.size)}</span>
              <a href={a.url} download={a.name} target="_blank" rel="noopener noreferrer" title="Download" style={{ color: STYLES.slate, flexShrink: 0, display: "flex" }}><Download size={13} /></a>
              <button onClick={() => handleRemove(a)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0, display: "flex" }}><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: STYLES.slate, cursor: uploading ? "default" : "pointer", border: `1px dashed ${STYLES.ink}33`, borderRadius: 4, padding: compact ? "4px 8px" : "5px 9px" }}>
        <Paperclip size={13} />
        {uploading ? "Uploading…" : "Attach files"}
        <input ref={inputRef} type="file" multiple onChange={handleFiles} disabled={uploading} style={{ display: "none" }} />
      </label>
      {uploadError && <div style={{ fontSize: 11, color: STYLES.wax, marginTop: 4 }}>{uploadError}</div>}
      {reading && <Reader a={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

// Read-only(ish) list for attachments on content that's already been sent
// (e.g. a past thread message) — view/download, and optionally remove, but
// no "add more" affordance so old messages don't sprout upload buttons.
export function AttachmentList({ attachments, onRemove }) {
  const [reading, setReading] = useState(null);
  const list = attachments || [];
  if (list.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
      {list.map((a) => (
        <div key={a.path} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: STYLES.ink + "08", borderRadius: 4, padding: "4px 8px" }}>
          <FileText size={13} color={STYLES.slate} style={{ flexShrink: 0 }} />
          <AttachmentName a={a} onRead={setReading} />
          <span style={{ color: STYLES.slate, flexShrink: 0 }}>{formatFileSize(a.size)}</span>
          {onRemove && <button onClick={() => onRemove(a)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, flexShrink: 0, display: "flex" }}><X size={13} /></button>}
        </div>
      ))}
      {reading && <Reader a={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

// Small clickable "📎 N" pill for list rows, toggling an AttachmentManager below.
export function AttachmentToggle({ count, open, onClick }) {
  return (
    <button onClick={onClick} title="Attachments" style={{ background: open ? STYLES.brass + "33" : "transparent", border: `1px solid ${STYLES.ink}22`, borderRadius: 10, padding: "3px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: STYLES.slate, flexShrink: 0 }}>
      <Paperclip size={11} /> {count > 0 ? count : "Attach"}
    </button>
  );
}
