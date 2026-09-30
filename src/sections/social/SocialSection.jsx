import { useState } from "react";
import { Images, CalendarRange, Layers, ListChecks } from "lucide-react";
import { STYLES, uid } from "../../constants";
import { TabButton, CenterMsg, ErrorBar } from "../../components/Shared";
import { savePost, setPostStatus, setPostCampaign, deletePostRow, setShotCompleted, setShotMediaLinks, insertCampaign, updateCampaign, deleteCampaignRow } from "../../lib/postsApi";
import { nextStatus } from "./socialConstants";
import useSocialData from "./useSocialData";
import MediaLibraryTab from "./MediaLibraryTab";
import PlannerTab from "./PlannerTab";
import CampaignsTab from "./CampaignsTab";
import ShotListTab from "./ShotListTab";
import PostForm from "./PostForm";
import CampaignForm from "./CampaignForm";

const SUBTABS = [
  { key: "planner", label: "Planner", icon: <CalendarRange size={14} /> },
  { key: "shots", label: "Shot List", icon: <ListChecks size={14} /> },
  { key: "campaigns", label: "Campaigns", icon: <Layers size={14} /> },
  { key: "library", label: "Media Library", icon: <Images size={14} /> },
];

export default function SocialSection({ currentUser }) {
  const [subtab, setSubtab] = useState("planner");
  const { posts, shots, campaigns, media, shotMedia, loading, error, setError, reloadAll } = useSocialData();
  const [postEditor, setPostEditor] = useState(null);       // null | { post: Post|null, defaults?: {campaignId}, notice?: string }
  const [campaignEditor, setCampaignEditor] = useState(null); // null | "new" | Campaign

  async function run(fn, failMsg) {
    try { await fn(); await reloadAll(); } catch (e) { setError(`${failMsg}: ${e.message}`); }
  }

  async function handleSavePost(post, shotList, removedIds, isNew, originalLinks) {
    await savePost(post, shotList, removedIds, isNew, originalLinks);
    setPostEditor(null);
    reloadAll();
  }
  async function handleDeletePost(post) {
    if (!window.confirm(`Delete "${post.title}" and its shot list? This can't be undone.`)) return;
    await run(() => deletePostRow(post.id), "Couldn't delete the post");
    setPostEditor(null);
  }
  const handleAdvance = (post) => {
    const next = nextStatus(post.postType, post.status);
    if (!next) return;
    if (next === "scheduled" && (!post.publishDate || !post.publishTime)) {
      // Scheduling puts the post on the calendar, so it needs a date and time first.
      setPostEditor({ post, notice: `Add a publish date and time to "${post.title}" before scheduling it.` });
      return;
    }
    run(() => setPostStatus(post.id, next), "Couldn't update the status");
  };

  const handleToggleShot = (shot, completed) => run(() => setShotCompleted(shot.id, completed), "Couldn't update the shot");
  const handleSetShotMedia = (shotId, mediaIds, previousIds) => run(() => setShotMediaLinks(shotId, mediaIds, previousIds), "Couldn't update the linked media");

  async function handleSaveCampaign(campaign, isNew) {
    if (isNew) await insertCampaign(campaign);
    else await updateCampaign(campaign.id, campaign);
    setCampaignEditor(null);
    reloadAll();
  }
  async function handleDeleteCampaign(campaign) {
    if (!window.confirm(`Delete the campaign "${campaign.name}"? Its posts are kept — they just stop belonging to a campaign.`)) return;
    await run(() => deleteCampaignRow(campaign.id), "Couldn't delete the campaign");
    setCampaignEditor(null);
  }

  // A campaign editor opened from a stale object should show the freshest copy.
  const liveCampaign = campaignEditor && campaignEditor !== "new" ? campaigns.find((c) => c.id === campaignEditor.id) || campaignEditor : null;

  return (
    <div>
      <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${STYLES.ink}22`, background: STYLES.parchment }}>
        {SUBTABS.map((t) => <TabButton key={t.key} active={subtab === t.key} onClick={() => setSubtab(t.key)} icon={t.icon} label={t.label} />)}
      </div>

      {subtab !== "library" && <ErrorBar>{error}</ErrorBar>}
      {subtab !== "library" && loading && <CenterMsg>Loading…</CenterMsg>}

      {subtab === "planner" && !loading && (
        <PlannerTab posts={posts} shots={shots} campaigns={campaigns} onOpenPost={(post) => setPostEditor({ post })} onAdvance={handleAdvance} />
      )}
      {subtab === "shots" && !loading && (
        <ShotListTab posts={posts} shots={shots} campaigns={campaigns} media={media} shotMedia={shotMedia} onOpenPost={(post) => setPostEditor({ post })} onToggleShot={handleToggleShot} onSetShotMedia={handleSetShotMedia} />
      )}
      {subtab === "campaigns" && !loading && (
        <CampaignsTab campaigns={campaigns} posts={posts} onOpenCampaign={setCampaignEditor} onNewCampaign={() => setCampaignEditor("new")} />
      )}
      {subtab === "library" && <MediaLibraryTab currentUser={currentUser} />}

      {postEditor && (
        <PostForm
          key={postEditor.post ? postEditor.post.id : "new"}
          post={postEditor.post}
          defaults={postEditor.defaults}
          notice={postEditor.notice}
          shots={postEditor.post ? shots.filter((s) => s.postId === postEditor.post.id) : []}
          shotMedia={shotMedia}
          media={media}
          campaigns={campaigns}
          currentUser={currentUser}
          onSave={handleSavePost}
          onDelete={handleDeletePost}
          onClose={() => setPostEditor(null)}
        />
      )}

      {campaignEditor && (
        <CampaignForm
          key={campaignEditor === "new" ? "new" : campaignEditor.id}
          campaign={liveCampaign}
          posts={liveCampaign ? posts.filter((p) => p.campaignId === liveCampaign.id) : []}
          allPosts={posts}
          currentUser={currentUser}
          onSave={handleSaveCampaign}
          onDelete={handleDeleteCampaign}
          onClose={() => setCampaignEditor(null)}
          onOpenPost={(post) => { setPostEditor({ post }); }}
          onNewPost={(campaignId) => { setPostEditor({ post: null, defaults: { campaignId } }); }}
          onLinkPost={(postId, campaignId) => run(() => setPostCampaign(postId, campaignId), "Couldn't add the post")}
          onUnlinkPost={(post) => run(() => setPostCampaign(post.id, null), "Couldn't remove the post")}
        />
      )}
    </div>
  );
}
