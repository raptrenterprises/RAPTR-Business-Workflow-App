import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { CenterMsg, ErrorBar, EmptyMsg } from "../../components/Shared";
import { fetchGscStatus, fetchGscTotals, fetchGscKeywords, fetchGscPageStats, runGscSync, normalizeUrl, shortPath } from "../../lib/gscApi";
import { setPostLiveUrl } from "../../lib/postsApi";

const RANGES = [7, 28, 90];
const nf = (n) => (n === null || n === undefined ? "–" : Number(n).toLocaleString("en-US"));

function ago(iso) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

// A headline number with its change from the previous period of the same length.
function Tile({ label, value, change, lowerIsBetter }) {
  const good = change === null || change === 0 ? null : lowerIsBetter ? change < 0 : change > 0;
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: "8px 10px", flex: "1 1 120px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: STYLES.slate }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      {change !== null && change !== undefined && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: good === null ? STYLES.slate : good ? STYLES.green : STYLES.rust }}>
          {change > 0 ? "▲" : change < 0 ? "▼" : "–"} {typeof change === "number" ? Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 1 }) : change}{lowerIsBetter ? "" : "%"} vs previous
        </div>
      )}
    </div>
  );
}

const SORTS = [
  { key: "clicks", label: "Most clicks" },
  { key: "impressions", label: "Most impressions" },
  { key: "keywords", label: "Most keywords" },
  { key: "position", label: "Best position" },
];
function sortPages(list, key) {
  const byClicks = (a, b) => b.clicks - a.clicks || b.impressions - a.impressions;
  const out = [...list];
  if (key === "impressions") out.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  else if (key === "keywords") out.sort((a, b) => b.keywordCount - a.keywordCount || byClicks(a, b));
  else if (key === "position") out.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || byClicks(a, b));
  else out.sort(byClicks);
  return out;
}

// Offered on a /blog/ page that isn't connected to a planner post yet: pick the post it belongs to.
function LinkPicker({ page, candidates, busy, onLink }) {
  const [choice, setChoice] = useState("");
  if (candidates.length === 0) return <div style={{ fontSize: 12, color: STYLES.slate, marginTop: 4 }}>Every blog post already has an address.</div>;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
      <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={busy} style={{ ...selectStyle(), flex: "1 1 200px", minWidth: 0, fontSize: 12.5 }}>
        <option value="">Link to a blog post…</option>
        {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <button type="button" disabled={!choice || busy} onClick={() => onLink(choice, page)} style={{ ...selectStyle(), cursor: !choice || busy ? "default" : "pointer", fontWeight: 600, opacity: !choice || busy ? 0.5 : 1 }}>Link</button>
    </div>
  );
}

// One page's row: rank, name (a blog post opens its planner page), and its numbers.
function PageCard({ rank, p, post, candidates, linking, onOpenPost, onLink }) {
  const rate = p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 1000) / 10 : 0;
  const isBlogAddress = /^\/blog\/[^/]+/i.test(shortPath(p.page));
  return (
    <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderLeft: `4px solid ${post ? STYLES.green : STYLES.gray}`, borderRadius: 6, padding: "8px 10px", display: "flex", gap: 10 }}>
      <div style={{ fontSize: 12, color: STYLES.slate, fontWeight: 700, minWidth: 22, paddingTop: 2 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {post ? (
          <button onClick={() => onOpenPost(post)} style={{ background: "none", border: "none", padding: 0, color: STYLES.green, fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", display: "inline-flex", gap: 3, alignItems: "center", wordBreak: "break-word" }}>{post.title} <ChevronRight size={14} style={{ flexShrink: 0 }} /></button>
        ) : (
          <a href={p.page} target="_blank" rel="noopener noreferrer" style={{ color: STYLES.ink, fontWeight: 700, fontSize: 14, wordBreak: "break-all", display: "inline-flex", gap: 4, alignItems: "center", textDecoration: "none" }}>{shortPath(p.page)} <ExternalLink size={12} style={{ flexShrink: 0, color: STYLES.slate }} /></a>
        )}
        <div style={{ fontSize: 12.5, color: STYLES.slate, marginTop: 2 }}>{nf(p.clicks)} clicks · {nf(p.impressions)} impressions · {rate}% click rate</div>
        <div style={{ fontSize: 12.5, color: STYLES.slate }}>Avg position {p.position ?? "–"} · {nf(p.keywordCount)} {p.keywordCount === 1 ? "keyword" : "keywords"}{p.topQuery ? ` · top: ${p.topQuery}` : ""}</div>
        {!post && !isBlogAddress && <div style={{ fontSize: 11.5, color: STYLES.slate, marginTop: 2 }}>Website page</div>}
        {!post && isBlogAddress && <LinkPicker page={p.page} candidates={candidates} busy={linking} onLink={onLink} />}
      </div>
    </div>
  );
}

const pctChange = (cur, prev) => (cur === null || prev === null || prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

export default function SearchConsoleTab({ posts, onOpenPost, onReload }) {
  const [days, setDays] = useState(28);
  const [status, setStatus] = useState(undefined); // undefined = loading, null = never synced
  const [totals, setTotals] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [pageStats, setPageStats] = useState([]);
  const [view, setView] = useState("pages"); // "pages" | "keywords"
  const [pageSearch, setPageSearch] = useState("");
  const [blogOnly, setBlogOnly] = useState(false);
  const [pageSort, setPageSort] = useState("clicks");
  const [pagesShown, setPagesShown] = useState(40);
  const [linking, setLinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [shown, setShown] = useState(40);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, t, k, p] = await Promise.all([fetchGscStatus(), fetchGscTotals(days), fetchGscKeywords(days), fetchGscPageStats(days)]);
      setStatus(st); setTotals(t); setKeywords(k); setPageStats(p); setError("");
    } catch (e) {
      setError(`Couldn't load Search Console data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  async function syncNow() {
    setSyncing(true); setError("");
    try { await runGscSync(); } catch (e) { setError(e.message); }
    setSyncing(false);
    load();
  }

  // Connects a /blog/ page to the planner post it belongs to, then refreshes so that post's keywords fill in.
  async function linkPage(postId, page) {
    setLinking(true); setError("");
    try {
      await setPostLiveUrl(postId, page);
      onReload?.();
      await runGscSync();
    } catch (e) { setError(`Couldn't link that page: ${e.message}`); }
    setLinking(false);
    load();
  }

  // Blog posts that have a live address, so a keyword's best page can be shown as the post it belongs to.
  const postByUrl = useMemo(() => {
    const m = new Map();
    posts.filter((p) => p.postType === "Blog post" && p.liveUrl).forEach((p) => { const k = normalizeUrl(p.liveUrl); if (k) m.set(k, p); });
    return m;
  }, [posts]);
  const blogCount = postByUrl.size;
  const postFor = (page) => postByUrl.get(normalizeUrl(page)) || null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keywords.filter((k) => (!q || k.query.toLowerCase().includes(q)) && (!linkedOnly || postFor(k.topPage)));
  }, [keywords, search, linkedOnly, postByUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  // Blog posts still waiting for an address (for the "Link to a blog post" lists), newest first.
  const waitingPosts = useMemo(() => posts.filter((p) => p.postType === "Blog post" && !p.liveUrl).sort((a, b) => String(b.publishDate || "").localeCompare(String(a.publishDate || ""))), [posts]);
  const pageRows = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    let list = pageStats.map((p) => ({ ...p, post: postFor(p.page) }));
    if (blogOnly) list = list.filter((p) => p.post);
    if (q) list = list.filter((p) => (p.post?.title || "").toLowerCase().includes(q) || shortPath(p.page).toLowerCase().includes(q) || (p.topQuery || "").toLowerCase().includes(q));
    return sortPages(list, pageSort);
  }, [pageStats, pageSearch, blogOnly, pageSort, postByUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = totals?.current;
  const prev = totals?.previous;
  const ctr = cur && cur.impressions > 0 ? Math.round((cur.clicks / cur.impressions) * 1000) / 10 : null;
  const prevCtr = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : null;
  const hasData = keywords.length > 0 || pageStats.length > 0 || !!cur;

  return (
    <div style={{ padding: 14, maxWidth: 900, margin: "0 auto" }}>
      <ErrorBar>{error}</ErrorBar>

      <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0, fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>Google Search Console</div>
          {status === undefined ? <span style={{ color: STYLES.slate }}>Checking…</span>
            : status === null ? <span style={{ color: STYLES.slate }}>Not synced yet. Once it's set up in Vercel, press Sync now.</span>
            : (
              <span style={{ color: status.status === "ok" ? STYLES.slate : STYLES.rust }}>
                {status.status === "ok" ? `Synced ${ago(status.lastSyncedAt)}. ` : `Last sync failed ${ago(status.lastSyncedAt)}. `}{status.message}
              </span>
            )}
          <div style={{ color: STYLES.slate, fontSize: 11.5, marginTop: 2 }}>Updates itself every morning. Google reports numbers about 2 to 3 days late.</div>
        </div>
        <button onClick={syncNow} disabled={syncing} style={{ ...selectStyle(), cursor: syncing ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, opacity: syncing ? 0.6 : 1 }}>
          <RefreshCw size={14} /> {syncing ? "Syncing… (the first sync can take a minute)" : "Sync now"}
        </button>
      </div>

      {loading && <CenterMsg>Loading…</CenterMsg>}
      {!loading && !hasData && <EmptyMsg>No Search Console data yet. After the first sync, your pages and keywords will show up here.</EmptyMsg>}

      {!loading && hasData && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: STYLES.slate }}>Last</span>
            {RANGES.map((d) => (
              <button key={d} onClick={() => { setDays(d); setShown(40); }} style={{ ...selectStyle(), cursor: "pointer", fontWeight: days === d ? 700 : 400, background: days === d ? `${STYLES.wax}18` : undefined, borderColor: days === d ? STYLES.wax : undefined }}>{d} days</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <Tile label="Clicks" value={nf(cur?.clicks)} change={pctChange(cur?.clicks ?? null, prev?.clicks ?? null)} />
            <Tile label="Impressions" value={nf(cur?.impressions)} change={pctChange(cur?.impressions ?? null, prev?.impressions ?? null)} />
            <Tile label="Click rate" value={ctr === null ? "–" : `${ctr}%`} change={pctChange(ctr, prevCtr)} />
            <Tile label="Avg position" value={cur?.position ?? "–"} change={cur?.position != null && prev?.position != null ? Math.round((cur.position - prev.position) * 10) / 10 : null} lowerIsBetter />
          </div>

          <div style={{ display: "flex", border: `1px solid ${STYLES.ink}33`, borderRadius: 4, overflow: "hidden", width: "fit-content", marginBottom: 10 }}>
            {[["pages", "Pages"], ["keywords", "Keywords"]].map(([key, label]) => (
              <button key={key} onClick={() => setView(key)} style={{ padding: "7px 16px", fontSize: 13, border: "none", cursor: "pointer", background: view === key ? STYLES.brass : "#fff", color: view === key ? STYLES.ink : STYLES.slate, fontWeight: view === key ? 700 : 400 }}>{label}</button>
            ))}
          </div>

          {view === "pages" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <input value={pageSearch} onChange={(e) => { setPageSearch(e.target.value); setPagesShown(40); }} placeholder="Search pages" style={{ ...selectStyle(), flex: "1 1 160px", minWidth: 0 }} />
                <select value={pageSort} onChange={(e) => { setPageSort(e.target.value); setPagesShown(40); }} style={selectStyle()}>
                  {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <label style={{ fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={blogOnly} onChange={(e) => { setBlogOnly(e.target.checked); setPagesShown(40); }} style={{ accentColor: STYLES.wax }} /> Blog posts only
                </label>
              </div>
              {pageRows.length === 0 && <EmptyMsg>No pages match.</EmptyMsg>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pageRows.slice(0, pagesShown).map((p, i) => (
                  <PageCard key={p.page} rank={i + 1} p={p} post={p.post} candidates={waitingPosts} linking={linking} onOpenPost={onOpenPost} onLink={linkPage} />
                ))}
              </div>
              {pageRows.length > pagesShown && <button onClick={() => setPagesShown(pagesShown + 40)} style={{ ...selectStyle(), cursor: "pointer", marginTop: 8 }}>Show more ({pageRows.length - pagesShown} left)</button>}
            </>
          )}

          {view === "keywords" && (
          <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Keywords</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setShown(40); }} placeholder="Search keywords" style={{ ...selectStyle(), flex: "1 1 180px", minWidth: 0 }} />
            <label style={{ fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={linkedOnly} onChange={(e) => { setLinkedOnly(e.target.checked); setShown(40); }} style={{ accentColor: STYLES.wax }} /> Only ones that lead to a blog post
            </label>
          </div>
          {blogCount === 0 && <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>No blog posts are linked yet. They connect on their own after a sync, or you can link a page by hand in the Pages view.</div>}

          {rows.length === 0 && <EmptyMsg>No keywords match.</EmptyMsg>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.slice(0, shown).map((k) => {
              const post = postFor(k.topPage);
              const rate = k.impressions > 0 ? Math.round((k.clicks / k.impressions) * 1000) / 10 : 0;
              return (
                <div key={k.query} style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderLeft: `4px solid ${post ? STYLES.green : STYLES.gray}`, borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, wordBreak: "break-word" }}>{k.query}</div>
                  <div style={{ fontSize: 12.5, color: STYLES.slate, marginTop: 2 }}>{nf(k.clicks)} clicks · {nf(k.impressions)} impressions · {rate}% click rate · position {k.position ?? "–"}</div>
                  <div style={{ fontSize: 12.5, marginTop: 4, wordBreak: "break-word" }}>
                    {post ? (
                      <button onClick={() => onOpenPost(post)} style={{ background: "none", border: "none", padding: 0, color: STYLES.green, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "inline-flex", gap: 3, alignItems: "center" }}>{post.title} <ChevronRight size={13} /></button>
                    ) : (
                      <span style={{ color: STYLES.slate }}>{shortPath(k.topPage)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {rows.length > shown && <button onClick={() => setShown(shown + 40)} style={{ ...selectStyle(), cursor: "pointer", marginTop: 8 }}>Show more ({rows.length - shown} left)</button>}

          </>
          )}
        </>
      )}
    </div>
  );
}
