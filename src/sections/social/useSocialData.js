import { useState, useEffect, useCallback } from "react";
import { fetchPosts, fetchShotItems, fetchCampaigns, fetchShotMedia, subscribePosts, subscribeShotItems, subscribeCampaigns, subscribeShotMedia } from "../../lib/postsApi";
import { fetchMedia, subscribeMedia } from "../../lib/mediaApi";

// Loads posts, shot items, campaigns, the media library, and shot<->media links once
// for the whole Social section and keeps them live, so the Planner, Campaigns tab,
// and the post editor share one source.
export default function useSocialData() {
  const [posts, setPosts] = useState([]);
  const [shots, setShots] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [media, setMedia] = useState([]);
  const [shotMedia, setShotMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadPosts = useCallback(async () => {
    try { setPosts(await fetchPosts()); setError(""); } catch (e) { setError("Couldn't load posts: " + e.message); }
  }, []);
  const reloadShots = useCallback(async () => {
    try { setShots(await fetchShotItems()); } catch (e) { setError("Couldn't load shot lists: " + e.message); }
  }, []);
  const reloadCampaigns = useCallback(async () => {
    try { setCampaigns(await fetchCampaigns()); } catch (e) { setError("Couldn't load campaigns: " + e.message); }
  }, []);
  const reloadMedia = useCallback(async () => {
    try { setMedia(await fetchMedia()); } catch (e) { setError("Couldn't load the media library: " + e.message); }
  }, []);
  const reloadShotMedia = useCallback(async () => {
    try { setShotMedia(await fetchShotMedia()); } catch (e) { setError("Couldn't load shot media links: " + e.message); }
  }, []);

  useEffect(() => {
    Promise.all([reloadPosts(), reloadShots(), reloadCampaigns(), reloadMedia(), reloadShotMedia()]).finally(() => setLoading(false));
    const subs = [
      subscribePosts(reloadPosts),
      subscribeShotItems(() => { reloadShots(); reloadPosts(); }), // a finished shot list can move a post to "Filmed"
      subscribeCampaigns(reloadCampaigns),
      subscribeMedia(reloadMedia),
      subscribeShotMedia(() => { reloadShotMedia(); reloadShots(); reloadPosts(); }),
    ];
    return () => subs.forEach((u) => u());
  }, [reloadPosts, reloadShots, reloadCampaigns, reloadMedia, reloadShotMedia]);

  const reloadAll = useCallback(() => Promise.all([reloadPosts(), reloadShots(), reloadCampaigns(), reloadMedia(), reloadShotMedia()]), [reloadPosts, reloadShots, reloadCampaigns, reloadMedia, reloadShotMedia]);
  return { posts, shots, campaigns, media, shotMedia, loading, error, setError, reloadAll };
}
