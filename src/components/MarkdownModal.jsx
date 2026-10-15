import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy } from "lucide-react";
import { STYLES } from "../constants";
import { markdownToHtml, markdownToPlain } from "../lib/markdown";
import { copyRich, copyPlain } from "../lib/clipboard";
import MarkdownView from "./MarkdownView";

// Full-screen reader for a Markdown file. Pass `title` and a `load` function that returns the file's text.
// "Formatted / Raw" flips between the readable view and the original text.
const pill = (active) => ({ padding: "5px 12px", fontSize: 12, border: "none", cursor: "pointer", background: active ? STYLES.brass : "#fff", color: active ? STYLES.ink : STYLES.slate, fontWeight: active ? 700 : 400 });
const smallBtn = { background: "transparent", border: `1px solid ${STYLES.slate}`, color: STYLES.slate, borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 };

export default function MarkdownModal({ title, load, onClose }) {
  const [state, setState] = useState({ status: "loading", text: "", message: "" });
  const [raw, setRaw] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", text: "", message: "" });
    Promise.resolve()
      .then(load)
      .then((text) => { if (!cancelled) setState({ status: "ready", text, message: "" }); })
      .catch((e) => { if (!cancelled) setState({ status: "error", text: "", message: (e && e.message) || "couldn't open the file" }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copyFormatted() {
    const ok = await copyRich(markdownToHtml(state.text, { external: false }), markdownToPlain(state.text));
    setNote(ok ? "Copied" : "Couldn't copy");
    setTimeout(() => setNote(""), 2000);
  }
  async function copyRaw() {
    const ok = await copyPlain(state.text);
    setNote(ok ? "Copied" : "Couldn't copy");
    setTimeout(() => setNote(""), 2000);
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 780, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 30px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${STYLES.ink}22`, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <div style={{ display: "flex", border: `1px solid ${STYLES.ink}33`, borderRadius: 4, overflow: "hidden" }}>
            <button type="button" onClick={() => setRaw(false)} style={pill(!raw)}>Formatted</button>
            <button type="button" onClick={() => setRaw(true)} style={pill(raw)}>Raw</button>
          </div>
          {state.status === "ready" && (
            <button type="button" onClick={raw ? copyRaw : copyFormatted} style={smallBtn}><Copy size={12} /> {note || (raw ? "Copy text" : "Copy formatted")}</button>
          )}
          <button type="button" onClick={onClose} title="Close" style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "16px 20px 24px", overflowY: "auto" }}>
          {state.status === "loading" && <div style={{ fontSize: 13, color: STYLES.slate, textAlign: "center", padding: "20px 0" }}>Opening…</div>}
          {state.status === "error" && <div style={{ fontSize: 13, color: STYLES.wax, fontWeight: 600 }}>Couldn't open this file: {state.message}</div>}
          {state.status === "ready" && (raw
            ? <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>{state.text}</pre>
            : <MarkdownView text={state.text} />)}
        </div>
      </div>
    </div>,
    document.body
  );
}
