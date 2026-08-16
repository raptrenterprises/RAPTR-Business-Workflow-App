// Wraps the Badging API (navigator.setAppBadge / clearAppBadge) with feature
// detection. Supported on Android Chrome and on iOS Safari 16.4+ when the
// app has been added to the Home Screen — silently does nothing elsewhere
// (regular browser tabs, unsupported browsers), which is fine since the
// nav-bar red dots already cover those cases.
//
// Errors are logged (not swallowed) so real failures — permission issues,
// an unsupported browser, etc. — are visible in the console instead of
// silently disappearing.
export function setAppBadge(count) {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
    console.warn("[appBadge] navigator.setAppBadge is not available in this browser/context.");
    return;
  }
  try {
    if (count > 0) {
      navigator.setAppBadge(count).catch((err) => console.error("[appBadge] setAppBadge failed:", err));
    } else if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch((err) => console.error("[appBadge] clearAppBadge failed:", err));
    }
  } catch (err) {
    console.error("[appBadge] setAppBadge threw synchronously:", err);
  }
}

export function clearAppBadge() {
  if (typeof navigator === "undefined" || !("clearAppBadge" in navigator)) return;
  try {
    navigator.clearAppBadge().catch((err) => console.error("[appBadge] clearAppBadge failed:", err));
  } catch (err) {
    console.error("[appBadge] clearAppBadge threw synchronously:", err);
  }
}
