import { useState, useMemo, useRef, useEffect } from "react";
import { X, FilePlus2, FolderOpen, Check, AlertTriangle } from "lucide-react";
import { STYLES, uid, selectStyle } from "../../constants";
import { uploadAttachment } from "../../lib/storageApi";
import { insertMediaBatch } from "../../lib/mediaApi";
import { makeThumbnailWithSize, isVideoFile } from "../../lib/thumbnails";
import { describeRatio } from "../../lib/aspectRatio";
import { cleanSubfolder, pathKey, isGenericName, stripExtension, collectionOf } from "../../lib/mediaLinks";
import { MEDIA_PEOPLE, normalizeTag } from "./socialConstants";

const inputStyle = { ...selectStyle(), fontSize: 14, padding: "8px 10px", boxSizing: "border-box" };

function Tile({ entry, status, onToggle }) {
  const border = entry.selected ? STYLES.green : status.duplicate ? STYLES.wax : `${STYLES.ink}22`;
  return (
    <div onClick={() => onToggle(entry.key)} style={{ position: "relative", background: "#fff", border: `2px solid ${border}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", opacity: status.duplicate ? 0.6 : 1 }}>
      <div style={{ aspectRatio: "1 / 1", background: STYLES.gray, display: "flex", alignItems: "center", justifyContent: "center", color: STYLES.slate, fontSize: 11, textAlign: "center", padding: 4 }}>
        {entry.thumbUrl ? <img src={entry.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : entry.thumbState === "pending" ? "Making preview…" : "No preview"}
      </div>
      <div style={{ padding: "4px 6px" }}>
        <div title={entry.name} style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
        {entry.aspectRatio && <div style={{ fontSize: 10, color: STYLES.slate }}>{entry.aspectRatio}</div>}
        {status.sub && <div title={status.sub} style={{ fontSize: 10, color: STYLES.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status.sub}/</div>}
        {status.duplicate && <div style={{ fontSize: 10.5, color: STYLES.wax, fontWeight: 700 }}>{status.duplicate}</div>}
        {!status.duplicate && status.generic && <div style={{ fontSize: 10.5, color: "#B8860B", fontWeight: 700 }}>Check this name</div>}
        {(entry.people.length > 0 || entry.tags.length > 0 || entry.isAi) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 3 }}>
            {entry.isAi && <span style={{ fontSize: 9.5, background: "#333", color: "#fff", borderRadius: 7, padding: "0 5px" }}>AI</span>}
            {entry.people.map((p) => <span key={p} style={{ fontSize: 9.5, color: STYLES.blue, border: `1px solid ${STYLES.blue}55`, borderRadius: 7, padding: "0 4px" }}>{p}</span>)}
            {entry.tags.map((t) => <span key={t} style={{ fontSize: 9.5, color: STYLES.purple, border: `1px solid ${STYLES.purple}55`, borderRadius: 7, padding: "0 4px" }}>{t}</span>)}
          </div>
        )}
      </div>
      {entry.selected && <div style={{ position: "absolute", top: 4, right: 4, background: STYLES.green, color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13} /></div>}
    </div>
  );
}

// Pick a batch of photos/videos from the device, review the captured file names, tag them in bulk, then add them all.
// Only a small preview is uploaded; the original files stay wherever you put them (OneDrive or a server).
export default function BulkAddModal({ existing, tagSuggestions, currentUser, onDone, onClose }) {
  const [kind, setKind] = useState("raw");
  const [batchSubfolder, setBatchSubfolder] = useState("");
  const [entries, setEntries] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const cancelled = useRef(false);
  const entriesRef = useRef([]);
  entriesRef.current = entries;
  useEffect(() => () => { cancelled.current = true; entriesRef.current.forEach((e) => e.thumbUrl && URL.revokeObjectURL(e.thumbUrl)); }, []);

  // A file's folder inside raw/ or edited/: the path typed for the whole batch, then any folders the
  // file came from when a whole folder was picked (sub-subfolders included), e.g. 2026-10/flatlays.
  const subfolderOf = (e) => cleanSubfolder([batchSubfolder, e.subfolder].filter(Boolean).join("/"));

  const patchEntry = (key, patch) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const patchSelected = (fn) => setEntries((list) => list.map((e) => (e.selected ? { ...e, ...fn(e) } : e)));

  async function addFiles(fileList, fromFolder) {
    const files = [...fileList].filter((f) => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|m4v|webm)$/i.test(f.name));
    if (files.length === 0) { setError("No photos or videos were found in that selection."); return; }
    setError("");
    const fresh = files.map((file) => {
      // Choosing a whole folder records its subfolder path (without a leading "raw"/"edited" level).
      let sub = "";
      if (fromFolder && file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split("/").slice(0, -1);
        if (parts.length && /^(raw|edited)$/i.test(parts[0])) parts.shift();
        sub = parts.join("/");
      }
      return {
        key: uid(), file, name: file.name, subfolder: sub, mediaType: isVideoFile(file) || /\.(mp4|mov|m4v|webm)$/i.test(file.name) ? "video" : "photo",
        thumbUrl: "", thumbBlob: null, thumbState: "pending", width: null, height: null, aspectRatio: "", tags: [], people: [], isAi: false, selected: false,
        shotDate: new Date(file.lastModified).toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
      };
    });
    setEntries((list) => [...list, ...fresh]);
    // Previews, a few at a time so a big batch doesn't freeze the page.
    let next = 0;
    const worker = async () => {
      while (next < fresh.length && !cancelled.current) {
        const entry = fresh[next++];
        try {
          const { blob, width, height } = await makeThumbnailWithSize(entry.file);
          if (cancelled.current) return;
          patchEntry(entry.key, { thumbBlob: blob, thumbUrl: URL.createObjectURL(blob), thumbState: "ok", width, height, aspectRatio: describeRatio(width, height) });
        } catch (_) {
          patchEntry(entry.key, { thumbState: "none" });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  const existingKeys = useMemo(() => new Set(existing.filter((i) => i.fileName).map((i) => pathKey(i.assetKind, i.subfolder, i.fileName))), [existing]);
  const statuses = useMemo(() => {
    const seen = new Set();
    const out = {};
    entries.forEach((e) => {
      const key = pathKey(kind, subfolderOf(e), e.name);
      let duplicate = "";
      if (existingKeys.has(key)) duplicate = "Already in library";
      else if (seen.has(key)) duplicate = "Same name twice in batch";
      seen.add(key);
      out[e.key] = { duplicate, generic: isGenericName(e.name), sub: subfolderOf(e) };
    });
    return out;
  }, [entries, kind, batchSubfolder, existingKeys]);

  const selectedCount = entries.filter((e) => e.selected).length;
  const addable = entries.filter((e) => !statuses[e.key]?.duplicate);
  const dupCount = entries.length - addable.length;
  const genericCount = addable.filter((e) => statuses[e.key]?.generic).length;
  const toggle = (key) => patchEntry(key, { selected: !entries.find((e) => e.key === key).selected });

  const addTagToSelected = (raw) => {
    const t = normalizeTag(raw);
    if (!t) return;
    patchSelected((e) => ({ tags: e.tags.includes(t) ? e.tags : [...e.tags, t] }));
    setTagInput("");
  };

  async function finish() {
    if (addable.length === 0) { setError("There's nothing new to add."); return; }
    setBusy("Uploading previews…");
    setError("");
    try {
      const items = [];
      let next = 0;
      let done = 0;
      const worker = async () => {
        while (next < addable.length) {
          const e = addable[next++];
          let thumbnailUrl = "";
          let thumbnailPath = "";
          if (e.thumbBlob) {
            const up = await uploadAttachment(new File([e.thumbBlob], `${stripExtension(e.name)}.jpg`, { type: "image/jpeg" }), "media/thumbs", currentUser);
            thumbnailUrl = up.url;
            thumbnailPath = up.path;
          }
          items.push({
            id: uid(), title: stripExtension(e.name), mediaType: e.mediaType, assetKind: kind, postFormat: "", sourceUrl: "", fileName: e.name,
            subfolder: subfolderOf(e), onedriveItemId: "", thumbnailUrl, thumbnailPath, isAi: e.isAi, aspectRatio: e.aspectRatio, width: e.width, height: e.height,
            people: e.people, tags: e.tags, shotDate: e.shotDate, notes: "", createdBy: currentUser, createdAt: new Date().toISOString(),
          });
          done += 1;
          setBusy(`Uploading previews… ${done}/${addable.length}`);
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      setBusy("Saving to the library…");
      for (let i = 0; i < items.length; i += 50) await insertMediaBatch(items.slice(i, i + 50));
      onDone(items.length);
    } catch (err) {
      setError("Couldn't finish: " + err.message + " Nothing was lost; fix the problem and try again.");
      setBusy("");
    }
  }

  const folderLabel = collectionOf(kind);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "16px 10px" }}>
      <div style={{ background: STYLES.parchment, border: `1px solid ${STYLES.ink}33`, borderRadius: 8, width: "100%", maxWidth: 960, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>Bulk add media</div>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: STYLES.ink }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 }}>These files are in the…</div>
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
              <option value="raw">raw folder (unedited)</option>
              <option value="finished">edited folder (finished)</option>
            </select>
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: STYLES.slate, marginBottom: 4 }}>Subfolder path inside {folderLabel}/ (optional)</div>
            <input value={batchSubfolder} onChange={(e) => setBatchSubfolder(e.target.value)} placeholder="e.g. 2026-10/flatlays" style={{ ...inputStyle, width: "100%" }} />
          </div>
          <label style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: STYLES.wax, color: STYLES.parchment, border: "none", fontWeight: 600 }}>
            <FilePlus2 size={15} /> Choose files
            <input type="file" accept="image/*,video/*" multiple onChange={(e) => { addFiles(e.target.files, false); e.target.value = ""; }} style={{ display: "none" }} />
          </label>
          <label style={{ ...selectStyle(), cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="On a computer: pick a whole folder">
            <FolderOpen size={15} /> Choose a folder
            <input type="file" multiple webkitdirectory="" directory="" onChange={(e) => { addFiles(e.target.files, true); e.target.value = ""; }} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 10 }}>
          Only a small preview is saved here. Put the same files in the same folder path on OneDrive (inside {folderLabel}/) with the same names. File names are captured automatically and must be unique within their folder. Folders can be nested, like 2026-10/flatlays. If you choose a whole folder on a computer, its own name and any folders inside it are added after the path you type.
        </div>

        {entries.length > 0 && (
          <>
            <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedCount} selected</span>
                <button type="button" onClick={() => setEntries((l) => l.map((e) => ({ ...e, selected: true })))} style={{ ...selectStyle(), cursor: "pointer" }}>Select all</button>
                <button type="button" onClick={() => setEntries((l) => l.map((e) => ({ ...e, selected: false })))} style={{ ...selectStyle(), cursor: "pointer" }}>Select none</button>
                <button type="button" disabled={selectedCount === 0} onClick={() => patchSelected(() => ({ tags: [], people: [], isAi: false }))} style={{ ...selectStyle(), cursor: "pointer", color: STYLES.wax }}>Clear tags on selected</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Who's in it</span>
                {MEDIA_PEOPLE.map((p) => (
                  <button key={p} type="button" disabled={selectedCount === 0} onClick={() => patchSelected((e) => ({ people: e.people.includes(p) ? e.people : [...e.people, p] }))} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${STYLES.blue}`, background: "#fff", color: STYLES.blue }}>+ {p}</button>
                ))}
                <button type="button" disabled={selectedCount === 0} onClick={() => patchSelected((e) => ({ isAi: true }))} style={{ padding: "4px 11px", fontSize: 12.5, borderRadius: 14, cursor: "pointer", border: `1px solid ${STYLES.ink}`, background: "#fff" }}>Mark AI</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: STYLES.slate, minWidth: 64 }}>Tags</span>
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTagToSelected(tagInput); } }} placeholder="Type a tag, press Enter" style={{ ...inputStyle, flex: "1 1 180px", maxWidth: 260 }} />
                <button type="button" disabled={selectedCount === 0 || !tagInput.trim()} onClick={() => addTagToSelected(tagInput)} style={{ ...selectStyle(), cursor: "pointer" }}>Add to selected</button>
                {tagSuggestions.slice(0, 12).map((t) => <button key={t} type="button" disabled={selectedCount === 0} onClick={() => addTagToSelected(t)} style={{ padding: "3px 10px", fontSize: 12, borderRadius: 12, cursor: "pointer", border: `1px solid ${STYLES.purple}66`, background: "#fff", color: STYLES.purple }}>+ {t}</button>)}
              </div>
            </div>

            {(dupCount > 0 || genericCount > 0) && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBF3DC", border: "1px solid #E6D08A", borderRadius: 6, padding: "8px 10px", fontSize: 12.5, marginBottom: 10 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  {dupCount > 0 && <div>{dupCount} {dupCount === 1 ? "file has" : "files have"} a name already used in this folder and won't be added. Rename the file (or change the subfolder) to include {dupCount === 1 ? "it" : "them"}.</div>}
                  {genericCount > 0 && <div>{genericCount} {genericCount === 1 ? "name looks" : "names look"} generic or auto-renamed (like image.jpg or “(1)”). Make sure the file in OneDrive has the same name.</div>}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, maxHeight: "50vh", overflowY: "auto", paddingBottom: 4 }}>
              {entries.map((e) => <Tile key={e.key} entry={e} status={statuses[e.key] || {}} onToggle={toggle} />)}
            </div>
          </>
        )}

        {error && <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: "8px 10px", borderRadius: 4, fontSize: 13, marginTop: 10 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 14 }}>
          {busy && <span style={{ fontSize: 13, color: STYLES.slate }}>{busy}</span>}
          <button type="button" onClick={onClose} disabled={!!busy} style={{ ...selectStyle(), cursor: "pointer", fontSize: 14, padding: "8px 14px" }}>Cancel</button>
          <button type="button" onClick={finish} disabled={!!busy || addable.length === 0} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: busy || addable.length === 0 ? "default" : "pointer", opacity: busy || addable.length === 0 ? 0.6 : 1 }}>
            {addable.length === 0 ? "Done" : `Done: add ${addable.length} ${addable.length === 1 ? "item" : "items"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
