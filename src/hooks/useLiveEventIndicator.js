import { useState, useEffect, useCallback, useRef } from "react";
import { fetchEvents, subscribeEvents } from "../lib/eventsApi";
import { isEventHappeningNow } from "../constants";

// True whenever at least one calendar event is currently in progress.
// Unlike the other nav indicators, this can change purely because time
// passed (no database change involved), so it re-checks on a timer as
// well as on realtime updates.
export function useLiveEventIndicator() {
  const [hasEventNow, setHasEventNow] = useState(false);
  const eventsRef = useRef([]);

  const recheck = useCallback(() => {
    setHasEventNow(eventsRef.current.some(isEventHappeningNow));
  }, []);

  const reload = useCallback(async () => {
    try {
      eventsRef.current = await fetchEvents();
      recheck();
    } catch {
      // non-fatal — indicator just won't show if this fails
    }
  }, [recheck]);

  useEffect(() => {
    reload();
    const unsubscribe = subscribeEvents(reload);
    const interval = setInterval(recheck, 60000); // re-check every minute as the clock moves
    return () => { unsubscribe(); clearInterval(interval); };
  }, [reload, recheck]);

  return hasEventNow;
}
