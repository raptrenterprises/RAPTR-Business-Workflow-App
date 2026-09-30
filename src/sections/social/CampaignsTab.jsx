import { Plus } from "lucide-react";
import { STYLES } from "../../constants";
import { EmptyMsg } from "../../components/Shared";
import { STATUS_LABEL, STATUS_COLOR } from "./socialConstants";

function CampaignCard({ campaign, posts, onOpen }) {
  const counts = {};
  posts.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
  return (
    <div onClick={() => onOpen(campaign)} style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderLeft: `4px solid ${STYLES.purple}`, borderRadius: 6, padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Georgia, serif", wordBreak: "break-word" }}>{campaign.name}</div>
      {campaign.description && <div style={{ fontSize: 13, color: STYLES.slate, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{campaign.description}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: STYLES.slate }}>{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
        {Object.entries(counts).map(([s, n]) => <span key={s} style={{ fontSize: 11.5, fontWeight: 600, color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}66`, background: `${STATUS_COLOR[s]}14`, borderRadius: 10, padding: "1px 8px" }}>{n} {STATUS_LABEL[s].toLowerCase()}</span>)}
      </div>
    </div>
  );
}

export default function CampaignsTab({ campaigns, posts, onOpenCampaign, onNewCampaign }) {
  return (
    <div style={{ padding: "16px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <button onClick={onNewCampaign} style={{ background: STYLES.wax, color: STYLES.parchment, border: "none", borderRadius: 4, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <Plus size={16} /> New campaign
      </button>
      {campaigns.length === 0 ? (
        <EmptyMsg>No campaigns yet. A campaign groups related posts, like a series or a launch, with its own notes.</EmptyMsg>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} posts={posts.filter((p) => p.campaignId === c.id)} onOpen={onOpenCampaign} />)}
        </div>
      )}
    </div>
  );
}
