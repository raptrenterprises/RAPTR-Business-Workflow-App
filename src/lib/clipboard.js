// Clipboard helpers. copyRich puts formatted text on the clipboard (headings, links and all) so it pastes
// into Squarespace's editor with its formatting; the plain version is only a fallback for apps that take text only.

export async function copyRich(html, plain) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain || ""], { type: "text/plain" }),
      })]);
      return true;
    }
  } catch { /* fall through to the older method */ }
  try {
    const box = document.createElement("div");
    box.contentEditable = "true";
    box.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    box.innerHTML = html;
    document.body.appendChild(box);
    const range = document.createRange();
    range.selectNodeContents(box);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand("copy");
    sel.removeAllRanges();
    box.remove();
    return ok;
  } catch { return false; }
}

export async function copyPlain(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}
