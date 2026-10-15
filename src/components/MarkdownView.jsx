import { useMemo } from "react";
import { STYLES } from "../constants";
import { markdownToHtml } from "../lib/markdown";

// Shows Markdown text as a readable page: real headings, bold, links, lists, tables. Used for blog posts in the
// Marketing planner, attached .md files, and .md files in Documents.
const CSS = `
.md-view{font-size:15px;line-height:1.65;color:#000;overflow-wrap:anywhere}
.md-view>:first-child{margin-top:0}
.md-view h1{font-family:Georgia,serif;font-size:26px;line-height:1.25;margin:0 0 12px}
.md-view h2{font-family:Georgia,serif;font-size:21px;line-height:1.3;margin:22px 0 8px}
.md-view h3{font-family:Georgia,serif;font-size:17px;margin:18px 0 6px}
.md-view h4,.md-view h5,.md-view h6{font-size:15px;margin:14px 0 4px}
.md-view p{margin:0 0 12px}
.md-view a{color:${STYLES.wax}}
.md-view ul,.md-view ol{margin:0 0 12px;padding-left:24px}
.md-view li{margin:3px 0}
.md-view blockquote{margin:0 0 12px;padding:2px 14px;border-left:3px solid ${STYLES.brass};color:${STYLES.slate}}
.md-view blockquote p:last-child{margin-bottom:6px}
.md-view code{background:rgba(0,0,0,.06);padding:1px 4px;border-radius:3px;font-size:13px}
.md-view pre{background:rgba(0,0,0,.06);padding:10px 12px;border-radius:6px;overflow-x:auto;margin:0 0 12px}
.md-view pre code{background:none;padding:0}
.md-view hr{border:0;border-top:1px solid rgba(0,0,0,.2);margin:18px 0}
.md-view table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%;margin:0 0 12px}
.md-view th,.md-view td{border:1px solid rgba(0,0,0,.22);padding:5px 9px;font-size:14px;text-align:left;vertical-align:top}
.md-view th{background:rgba(0,0,0,.05)}
.md-view img{max-width:100%;height:auto}
`;

export default function MarkdownView({ text }) {
  const html = useMemo(() => markdownToHtml(text), [text]);
  return (
    <>
      <style>{CSS}</style>
      {/* The converter escapes all HTML and keeps only http/https/mailto links, so this is safe to insert. */}
      <div className="md-view" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
