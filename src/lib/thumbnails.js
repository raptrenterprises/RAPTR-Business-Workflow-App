// Builds a small JPEG thumbnail from a local photo or video file, entirely in
// the browser. Only this thumbnail is uploaded — the original file stays in
// OneDrive. Some formats (e.g. iPhone HEIC photos) can't be decoded by every
// browser; in that case makeThumbnail throws and the caller carries on without one.

const MAX_DIM = 480;

export function isVideoFile(file) {
  return (file.type || "").startsWith("video/");
}

function drawScaled(source, w, h) {
  if (!w || !h) return Promise.reject(new Error("Couldn't read this file's dimensions."));
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create a thumbnail."))), "image/jpeg", 0.8);
  });
}

function imageThumb(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => drawScaled(img, img.naturalWidth, img.naturalHeight).then(resolve, reject).finally(() => URL.revokeObjectURL(url));
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This browser can't read that image format.")); };
    img.src = url;
  });
}

function videoThumb(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    let done = false;
    const finish = (fn, val) => { if (done) return; done = true; clearTimeout(timer); URL.revokeObjectURL(url); fn(val); };
    const timer = setTimeout(() => finish(reject, new Error("Timed out reading the video.")), 15000);
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.onerror = () => finish(reject, new Error("This browser can't read that video format."));
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      drawScaled(v, v.videoWidth, v.videoHeight).then((b) => finish(resolve, b), (e) => finish(reject, e));
    };
    v.src = url;
  });
}

export function makeThumbnail(file) {
  return isVideoFile(file) ? videoThumb(file) : imageThumb(file);
}
