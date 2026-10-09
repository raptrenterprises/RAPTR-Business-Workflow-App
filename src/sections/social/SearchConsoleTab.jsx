import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { CenterMsg, ErrorBar, EmptyMsg } from "../../components/Shared";
import { fetchGscStatus, fetchGscTotals, fetchGscKeywords, fetchGscPages, runGscSync, normalizeUrl, shortPath } from "../../lib/gscApi";

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

const pctChange = (cur, prev) => (cur === null || prev === null || prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

export default function SearchConsoleTab({ posts, onOpenPost }) {
  const [days, setDays] = useState(28);
  const [status, setStatus] = useState(undefined); // undefined = loading, null = never synced
  const [totals, setTotals] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [shown, setShown] = useState(40);
  const [showPages, setShowPages] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, t, k, p] = await Promise.all([fetchGscStatus(), fetchGscTotals(days), fetchGscKeywords(days), fetchGscPages(days)]);
      setStatus(st); setTotals(t); setKeywords(k); setPages(p); setError("");
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
  const unlinkedPages = useMemo(() => pages.filter((p) => !postFor(p.page)).slice(0, 12), [pages, postByUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = totals?.current;
  const prev = totals?.previous;
  const ctr = cur && cur.impressions > 0 ? Math.round((cur.clicks / cur.impressions) * 1000) / 10 : null;
  const prevCtr = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : null;
  const hasData = keywords.length > 0 || !!cur;

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
      {!loading && !hasData && <EmptyMsg>No Search Console data yet. After the first sync, your keywords and page results will show up here.</EmptyMsg>}

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

          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Keywords</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setShown(40); }} placeholder="Search keywords" style={{ ...selectStyle(), flex: "1 1 180px", minWidth: 0 }} />
            <label style={{ fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={linkedOnly} onChange={(e) => { setLinkedOnly(e.target.checked); setShown(40); }} style={{ accentColor: STYLES.wax }} /> Only ones that lead to a blog post
            </label>
          </div>
          {blogCount === 0 && <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 8 }}>No blog posts are linked yet. Add the published address to a blog post (in its Blog post section) and its keywords will connect here.</div>}

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

          {unlinkedPages.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <button onClick={() => setShowPages(!showPages)} style={{ background: "none", border: "none", padding: 0, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center" }}>
                {showPages ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Pages not linked to a blog post
              </button>
              {showPages && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 6 }}>To link one, paste its address into that blog post's "Published blog post address" field.</div>
                  {unlinkedPages.map((p) => (
                    <div key={p.page} style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 6, padding: "6px 10px", marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>{shortPath(p.page)}</div>
                      <div style={{ fontSize: 12, color: STYLES.slate }}>{nf(p.clicks)} clicks · {nf(p.impressions)} impressions · position {p.position ?? "–"}{p.topQuery ? ` · top keyword: ${p.topQuery}` : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
