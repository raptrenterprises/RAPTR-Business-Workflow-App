import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Upload, FileText, ArrowLeft, Download, Trash2, Pencil } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { CenterMsg, ErrorBar } from "../../components/Shared";
import { formatFileSize } from "../../lib/storageApi";
import { fetchDocuments, uploadDocument, renameDocument, deleteDocument, downloadDocumentBlob, subscribeDocuments } from "../../lib/rrApi";
import { DOCUMENT_ACCEPT, documentType, validateUpload, titleFromFileName } from "../../lib/rrLogic";

const DocumentViewer = lazy(() => import("./DocumentViewer"));

const cardStyle = { background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 18 };
const primaryBtn = (disabled) => ({ background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", cursor: disabled ? "default" : "pointer", fontSize: 14, opacity: disabled ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6 });
const ghostBtn = { background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "9px 14px", cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 };

const dateLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function UploadPanel({ uploading, onUpload, onCancel }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const inputRef = useRef(null);

  function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const msg = validateUpload(f);
    if (msg) { setProblem(msg); setFile(null); return; }
    setProblem("");
    setFile(f);
    if (!title.trim()) setTitle(titleFromFileName(f.name));
  }
  function submit() {
    const msg = validateUpload(file);
    if (msg) { setProblem(msg); return; }
    if (!title.trim()) { setProblem("Give the document a title."); return; }
    setProblem("");
    onUpload(file, title);
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 16, background: STYLES.brass + "14", borderColor: STYLES.brass }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: STYLES.slate }}>
        Title
        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Halloween Dinner checklist" style={{ ...selectStyle(), fontSize: 15, color: STYLES.ink }} />
      </label>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input ref={inputRef} type="file" accept={DOCUMENT_ACCEPT} onChange={pick} style={{ display: "none" }} aria-label="Choose a file" />
        <button onClick={() => inputRef.current && inputRef.current.click()} disabled={uploading} style={ghostBtn}><FileText size={14} /> {file ? "Change file" : "Choose file"}</button>
        {file && <span style={{ fontSize: 13 }}>{file.name} <span style={{ color: STYLES.slate }}>({formatFileSize(file.size)})</span></span>}
      </div>
      <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 8 }}>PDF, Word (.docx) or image, up to 25 MB.</div>
      {problem && <div style={{ marginTop: 10, fontSize: 13, color: STYLES.wax, fontWeight: 600 }}>{problem}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={uploading} style={primaryBtn(uploading)}><Upload size={14} /> {uploading ? "Uploading…" : "Upload"}</button>
        <button onClick={onCancel} disabled={uploading} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function DocRow({ doc, onOpen }) {
  const type = documentType(doc.fileName);
  return (
    <button onClick={() => onOpen(doc.id)} style={{ ...cardStyle, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", font: "inherit", width: "100%" }}>
      <FileText size={22} color={STYLES.wax} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
        <span style={{ display: "block", fontSize: 12, color: STYLES.slate }}>
          {[type ? type.label : "File", formatFileSize(doc.size), doc.uploadedBy, dateLabel(doc.createdAt)].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

function DocumentPage({ doc, busy, onBack, onRename, onDelete, onDownload }) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(doc.title);
  async function saveTitle() {
    if (!title.trim()) return;
    if (await onRename(doc.id, title)) setRenaming(false);
  }
  return (
    <>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 14 }}><ArrowLeft size={14} /> Back</button>
      {renaming ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }} style={{ ...selectStyle(), flex: 1, minWidth: 0, fontSize: 16 }} aria-label="Document title" autoFocus />
          <button onClick={saveTitle} disabled={busy || !title.trim()} style={primaryBtn(busy || !title.trim())}>Save</button>
          <button onClick={() => { setRenaming(false); setTitle(doc.title); }} disabled={busy} style={ghostBtn}>Cancel</button>
        </div>
      ) : (
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{doc.title}</div>
      )}
      <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 12 }}>
        {[doc.fileName, formatFileSize(doc.size), doc.uploadedBy && `Added by ${doc.uploadedBy}`, dateLabel(doc.createdAt)].filter(Boolean).join(" · ")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={() => onDownload(doc)} disabled={busy} style={ghostBtn}><Download size={14} /> Download</button>
        <button onClick={() => setRenaming(true)} disabled={busy || renaming} style={ghostBtn}><Pencil size={14} /> Rename</button>
        <button onClick={() => onDelete(doc)} disabled={busy} style={{ ...ghostBtn, color: STYLES.wax, borderColor: STYLES.wax }}><Trash2 size={14} /> Delete</button>
      </div>
      <Suspense fallback={<div style={{ fontSize: 13, color: STYLES.slate }}>Loading viewer…</div>}>
        <DocumentViewer doc={doc} />
      </Suspense>
    </>
  );
}

export default function DocumentsSection({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try { setDocs(await fetchDocuments()); setError(""); }
    catch (e) { setError("Couldn't load Documents: " + e.message + " (has migration 024 been run?)"); }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
    return subscribeDocuments(reload);
  }, [reload]);

  async function upload(file, title) {
    setUploading(true);
    try { await uploadDocument(file, title, currentUser); await reload(); setUploadOpen(false); setError(""); }
    catch (e) { setError("Couldn't upload: " + e.message); }
    finally { setUploading(false); }
  }
  async function rename(id, title) {
    setBusy(true);
    try { await renameDocument(id, title); await reload(); return true; }
    catch (e) { setError("Couldn't rename: " + e.message); return false; }
    finally { setBusy(false); }
  }
  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This removes the file for both of you.`)) return;
    setBusy(true);
    try { await deleteDocument(doc); setOpenId(null); await reload(); }
    catch (e) { setError("Couldn't delete: " + e.message); }
    finally { setBusy(false); }
  }
  async function download(doc) {
    setBusy(true);
    try {
      const blob = await downloadDocumentBlob(doc.storagePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = doc.fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setError("Couldn't download: " + e.message); }
    finally { setBusy(false); }
  }

  if (loading) return <CenterMsg>Loading Documents…</CenterMsg>;
  const open = docs.find((d) => d.id === openId) || null;

  return (
    <>
      <ErrorBar>{error}</ErrorBar>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        {open ? (
          <DocumentPage key={open.id} doc={open} busy={busy} onBack={() => setOpenId(null)} onRename={rename} onDelete={remove} onDownload={download} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700 }}>Documents</div>
              {!uploadOpen && <button onClick={() => setUploadOpen(true)} style={primaryBtn(false)}><Upload size={14} /> Upload</button>}
            </div>
            {uploadOpen && <UploadPanel uploading={uploading} onUpload={upload} onCancel={() => setUploadOpen(false)} />}
            {docs.length === 0 && !uploadOpen && (
              <div style={{ ...cardStyle, fontSize: 14, color: STYLES.slate, textAlign: "center", padding: 28 }}>No documents yet. Tap Upload to add one.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((d) => <DocRow key={d.id} doc={d} onOpen={setOpenId} />)}
            </div>
          </>
        )}
      </main>
    </>
  );
}
