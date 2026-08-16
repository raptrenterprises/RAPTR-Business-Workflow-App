// Wraps the Badging API (navigator.setAppBadge / clearAppBadge) with feature
// detection. Supported on Android Chrome and on iOS Safari 16.4+ when the
// app has been added to the Home Screen — silently does nothing elsewhere
// (regular browser tabs, unsupported browsers), which is fine since the
// nav-bar red dots already cover those cases.
export function setAppBadge(count) {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
  try {
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  } catch {
    // non-fatal — badge just won't show
  }
}

export function clearAppBadge() {
  if (typeof navigator === "undefined" || !("clearAppBadge" in navigator)) return;
  try {
    navigator.clearAppBadge().catch(() => {});
  } catch {
    // non-fatal
  }
}
