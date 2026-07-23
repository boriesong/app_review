// App metadata (name, developer, icon) from the iTunes Lookup API.
//
// The Lookup endpoint does NOT send CORS headers, so a normal fetch() from the
// browser is blocked. It does, however, support JSONP via a `callback` param,
// which we load with a <script> tag — a technique this API is designed for.

const LOOKUP_BASE = "https://itunes.apple.com/lookup";

let counter = 0;

/**
 * @returns {Promise<{name, artist, icon, url, rating, ratingCount, genre}|null>}
 *          Resolves null on failure — the app name is a nice-to-have, never fatal.
 */
export function fetchAppInfo(appId, country = "kr", timeoutMs = 8000) {
  if (typeof document === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const cbName = `__appinfo_cb_${Date.now()}_${counter++}`;
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    window[cbName] = (data) => {
      try {
        const r = data && data.results && data.results[0];
        if (!r) return finish(null);
        finish({
          name: r.trackName || r.trackCensoredName || "",
          artist: r.artistName || "",
          icon: r.artworkUrl100 || r.artworkUrl60 || "",
          url: r.trackViewUrl || "",
          rating: r.averageUserRating != null ? Math.round(r.averageUserRating * 10) / 10 : null,
          ratingCount: r.userRatingCount != null ? r.userRatingCount : null,
          genre: r.primaryGenreName || "",
        });
      } catch {
        finish(null);
      }
    };

    script.onerror = () => finish(null);
    script.src = `${LOOKUP_BASE}?id=${encodeURIComponent(appId)}&country=${encodeURIComponent(
      country
    )}&callback=${cbName}`;
    document.head.appendChild(script);
  });
}
