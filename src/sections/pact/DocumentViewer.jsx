import { useState, useEffect, useRef } from "react";
import { STYLES } from "../../constants";
import { downloadDocumentBlob } from "../../lib/rrApi";
import { documentType } from "../../lib/rrLogic";
import MarkdownView from "../../components/MarkdownView";

// Lazy-loaded from the Documents screen, so the PDF and Word libraries only download when you open a document.
// Files are fetched through your sign-in (the bucket is private) and drawn right here. Nothing is sent to a third party.

const frame = { background: "#E4E4E4", borderRadius: 6, padding: 8 };

function Status({ state }) {
  if (state.status === "loading") return <div style={{ fontSize: 13, color: STYLES.slate, padding: "20px 0", textAlign: "center" }}>Loading document…</div>;
  if (state.status === "error") return <div style={{ fontSize: 13, color: STYLES.wax, fontWeight: 600, padding: "12px 0" }}>Couldn't show this document: {state.message}</div>;
  return null;
}

// PDF: every page drawn onto a canvas with pdf.js, scaled to the width of the screen. Works the same on phones and desktop.
function PdfView({ blob }) {
  const hostRef = useRef(null);
  const [state, setState] = useState({ status: "loading", message: "" });

  useEffect(() => {
    let cancelled = false;
    let task = null;
    (async () => {
      try {
        const [pdfjs, worker] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const data = new Uint8Array(await blob.arrayBuffer());
        task = pdfjs.getDocument({ data });
        const pdf = await task.promise;
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.innerHTML = "";
        const width = Math.min(host.clientWidth || 800, 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= pdf.numPages; n += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.cssText = `display:block;margin:0 auto 10px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);width:${width}px;height:${canvas.height / dpr}px;max-width:100%`;
          host.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
          if (n === 1) setState({ status: "ready", message: "" });
        }
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e.message || "unknown error" });
      }
    })();
    return () => { cancelled = true; if (task) task.destroy(); };
  }, [blob]);

  return (
    <div style={frame}>
      <Status state={state} />
      <div ref={hostRef} />
    </div>
  );
}

// Word (.docx): rendered in the page with docx-preview, then scaled down to fit narrow screens.
function DocxView({ blob }) {
  const outerRef = useRef(null);
  const hostRef = useRef(null);
  const [state, setState] = useState({ status: "loading", message: "" });

  useEffect(() => {
    let cancelled = false;
    const fit = () => {
      const outer = outerRef.current;
      const host = hostRef.current;
      if (!outer || !host) return;
      host.style.transform = "none";
      const pages = Array.from(host.querySelectorAll("section.docx"));
      const pageWidth = Math.max(0, ...pages.map((p) => p.offsetWidth));
      if (!pageWidth) return;
      const scale = Math.min(1, outer.clientWidth / pageWidth);
      host.style.width = `${pageWidth}px`;
      host.style.transformOrigin = "top left";
      host.style.transform = `scale(${scale})`;
      outer.style.height = `${host.offsetHeight * scale}px`;
    };
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        const host = hostRef.current;
        if (!host) return;
        host.innerHTML = "";
        await renderAsync(await blob.arrayBuffer(), host, undefined, { inWrapper: false, ignoreLastRenderedPageBreak: true });
        if (cancelled) return;
        host.querySelectorAll("section.docx").forEach((p) => {
          p.style.background = "#fff";
          p.style.boxShadow = "0 1px 4px rgba(0,0,0,.25)";
          p.style.marginBottom = "10px";
        });
        fit();
        setState({ status: "ready", message: "" });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e.message || "unknown error" });
      }
    })();
    window.addEventListener("resize", fit);
    return () => { cancelled = true; window.removeEventListener("resize", fit); };
  }, [blob]);

  return (
    <div style={frame}>
      <Status state={state} />
      <div ref={outerRef} style={{ overflow: "hidden" }}>
        <div ref={hostRef} />
      </div>
    </div>
  );
}

// Markdown (.md): shown as a readable page instead of raw text full of # and * symbols.
function MarkdownDocView({ blob }) {
  const [state, setState] = useState({ status: "loading", text: "", message: "" });
  useEffect(() => {
    let cancelled = false;
    blob.text()
      .then((text) => { if (!cancelled) setState({ status: "ready", text, message: "" }); })
      .catch((e) => { if (!cancelled) setState({ status: "error", text: "", message: e.message || "unknown error" }); });
    return () => { cancelled = true; };
  }, [blob]);
  return (
    <div style={frame}>
      <Status state={state} />
      {state.status === "ready" && <div style={{ background: "#fff", borderRadius: 4, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }}><MarkdownView text={state.text} /></div>}
    </div>
  );
}

function ImageView({ blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <div style={frame}>
      {url && <img src={url} alt="" style={{ display: "block", maxWidth: "100%", margin: "0 auto" }} />}
    </div>
  );
}

export default function DocumentViewer({ doc }) {
  const [state, setState] = useState({ status: "loading", blob: null, message: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", blob: null, message: "" });
    downloadDocumentBlob(doc.storagePath)
      .then((blob) => { if (!cancelled) setState({ status: "ready", blob, message: "" }); })
      .catch((e) => { if (!cancelled) setState({ status: "error", blob: null, message: e.message || "download failed" }); });
    return () => { cancelled = true; };
  }, [doc.storagePath]);

  if (state.status !== "ready") return <div style={frame}><Status state={state} /></div>;

  const kind = documentType(doc.fileName)?.kind;
  if (kind === "pdf") return <PdfView blob={state.blob} />;
  if (kind === "docx") return <DocxView blob={state.blob} />;
  if (kind === "image") return <ImageView blob={state.blob} />;
  if (kind === "markdown") return <MarkdownDocView blob={state.blob} />;
  return <div style={frame}><div style={{ fontSize: 13, padding: 12 }}>This file type can't be shown here. Use Download.</div></div>;
}
