// A small, dependency-free Markdown reader. Pure functions, no React, no Supabase.
//
// Handles what blog posts and notes files actually use: # headings, paragraphs, **bold**, *italic*, ~~strike~~,
// `code`, [links](https://…), images, bullet / numbered / nested lists, [ ] checklists, > quotes, --- rules,
// ``` code blocks and simple tables. Anything that looks like HTML is shown as plain text, never run, and only
// https / http / mailto links are kept, so a pasted file can't inject anything into the page.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function safeUrl(u) {
  const t = String(u || "").trim();
  return /^(https?:\/\/|mailto:)/i.test(t) ? t : null;
}

// ---- inline (bold, italic, links, code …) ----

function emphasis(s) {
  return s
    .replace(/\*\*\*([^\s*](?:[^*]*[^\s*])?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__([^\s_](?:[^_]*[^\s_])?)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/(^|[^*\w])\*([^\s*](?:[^*]*[^\s*])?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_([^\s_](?:[^_]*[^\s_])?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^\s~](?:[^~]*[^\s~])?)~~/g, "<del>$1</del>");
}

function inline(raw, opts) {
  const stash = [];
  const put = (html) => { stash.push(html); return `\u0001${stash.length - 1}\u0001`; };
  const linkAttrs = opts.external ? ' target="_blank" rel="noopener noreferrer"' : "";
  let s = String(raw);

  s = s.replace(/`([^`\n]+)`/g, (_, c) => put(`<code>${esc(c)}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g, (m, alt, url) => {
    const u = safeUrl(url);
    return u ? put(`<img src="${esc(u)}" alt="${esc(alt)}">`) : m;
  });
  s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g, (m, text, url) => {
    const u = safeUrl(url);
    return u ? put(`<a href="${esc(u)}"${linkAttrs}>${emphasis(esc(text))}</a>`) : m;
  });
  s = s.replace(/<(https?:\/\/[^\s>]+)>/g, (m, url) => put(`<a href="${esc(url)}"${linkAttrs}>${esc(url)}</a>`));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)"'])/g, (m, pre, url) => `${pre}${put(`<a href="${esc(url)}"${linkAttrs}>${esc(url)}</a>`)}`);

  s = emphasis(esc(s));
  s = s.replace(/(?: {2,}|\\)\n/g, "<br>");

  let guard = 0;
  while (/\u0001\d+\u0001/.test(s) && guard++ < 5) s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => stash[Number(i)]);
  return s;
}

// ---- blocks ----

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const QUOTE = /^\s{0,3}>\s?/;
const LI = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const isBlockStart = (line, next) =>
  HEADING.test(line) || HR.test(line) || FENCE.test(line) || QUOTE.test(line) || LI.test(line) ||
  (line.includes("|") && next !== undefined && TABLE_SEP.test(next));

function splitRow(line) {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function buildList(items, idx, indent, opts) {
  const ordered = items[idx].ordered;
  const tag = ordered ? "ol" : "ul";
  let html = `<${tag}>`;
  while (idx < items.length && items[idx].indent === indent && items[idx].ordered === ordered) {
    const it = items[idx];
    idx += 1;
    let text = [it.text, ...it.cont].join(" ");
    let box = "";
    const t = text.match(/^\[( |x|X)\]\s+(.*)$/);
    if (t) { box = t[1] === " " ? "\u2610 " : "\u2611 "; text = t[2]; }
    let inner = box + inline(text, opts);
    if (idx < items.length && items[idx].indent > indent) {
      const sub = buildList(items, idx, items[idx].indent, opts);
      inner += sub.html;
      idx = sub.idx;
    }
    html += `<li>${inner}</li>`;
  }
  return { html: `${html}</${tag}>`, idx };
}

function blocks(lines, opts) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i += 1; continue; }

    if (FENCE.test(line)) {
      const fence = line.trim().slice(0, 3);
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) { code.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    let m = line.match(HEADING);
    if (m) {
      const n = m[1].length;
      out.push(`<h${n}>${inline(m[2], opts)}</h${n}>`);
      i += 1;
      continue;
    }

    if (HR.test(line)) { out.push("<hr>"); i += 1; continue; }

    if (QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE.test(lines[i])) { inner.push(lines[i].replace(QUOTE, "")); i += 1; }
      out.push(`<blockquote>${blocks(inner, opts)}</blockquote>`);
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && !LI.test(line)) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? "center" : /-:$/.test(c) ? "right" : /^:-/.test(c) ? "left" : ""));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i += 1; }
      const cell = (tag, c, k) => `<${tag}${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${inline(c, opts)}</${tag}>`;
      out.push(`<table><thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell("td", r[k] || "", k)).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }

    if (LI.test(line)) {
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const lm = l.match(LI);
        if (lm && !HR.test(l)) {
          items.push({ indent: lm[1].replace(/\t/g, "    ").length, ordered: /\d/.test(lm[2]), text: lm[3], cont: [] });
          i += 1;
        } else if (/^\s*$/.test(l)) {
          let j = i + 1;
          while (j < lines.length && /^\s*$/.test(lines[j])) j += 1;
          if (j < lines.length && (LI.test(lines[j]) || /^\s{2,}\S/.test(lines[j])) && items.length) i = j;
          else break;
        } else if (/^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1].cont.push(l.trim());
          i += 1;
        } else break;
      }
      let idx = 0;
      while (idx < items.length) {
        const built = buildList(items, idx, items[idx].indent, opts);
        out.push(built.html);
        idx = built.idx;
      }
      continue;
    }

    const para = [line.trim()];
    i += 1;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i], lines[i + 1])) {
      para.push(/ {2,}$/.test(lines[i - 1]) ? "\n" + lines[i].trim() : lines[i].trim());
      i += 1;
    }
    out.push(`<p>${inline(para.join(" ").replace(/ \n/g, "\n"), opts)}</p>`);
  }
  return out.join("");
}

// options.external: true (default) makes links open in a new tab. The Squarespace copy turns it off for clean HTML.
export function markdownToHtml(md, options = {}) {
  const opts = { external: options.external !== false };
  return blocks(String(md || "").replace(/\r\n?/g, "\n").split("\n"), opts);
}

// If the text starts with a "# Title" line, split it off: { title, body }. Otherwise title is "" and body is everything.
export function splitTitle(md) {
  const text = String(md || "").replace(/\r\n?/g, "\n");
  const m = text.match(/^\s*#[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n|$)/);
  if (!m) return { title: "", body: text.trim() };
  return { title: m[1].trim(), body: text.slice(m[0].length).trim() };
}

// Readable plain text (links kept as "text (url)"), used as the fallback when the clipboard only takes text.
export function markdownToPlain(md) {
  return String(md || "").replace(/\r\n?/g, "\n")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, "$1 ($2)")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .trim();
}

export function wordCount(md) {
  const t = markdownToPlain(md);
  return t ? t.split(/\s+/).length : 0;
}

export const isMarkdownName = (name) => /\.(md|markdown)$/i.test(String(name || ""));
