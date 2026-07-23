// iTunes RSS customer-reviews fetcher.
// The endpoint is flaky: identical requests intermittently return a feed with no
// `entry` array. We retry each page a few times before treating an empty page as
// the true end of data. Apple caps this feed at ~10 pages (500 reviews).

const RSS_BASE = "https://itunes.apple.com";

export function reviewsUrl(appId, country, page, sortBy = "mostrecent") {
  return `${RSS_BASE}/${country}/rss/customerreviews/page=${page}/id=${appId}/sortby=${sortBy}/json`;
}

function label(node) {
  return node && node.label != null ? node.label : "";
}

// A feed entry is either the app-info header (has im:name, no im:rating) or a
// review (has im:rating). We keep only reviews and surface the app name.
function normalizeEntry(e) {
  if (!e || !e["im:rating"]) return null;
  const ratingRaw = parseInt(label(e["im:rating"]), 10);
  return {
    id: label(e.id),
    author: label(e.author && e.author.name),
    rating: Number.isFinite(ratingRaw) ? Math.max(1, Math.min(5, ratingRaw)) : null,
    version: label(e["im:version"]),
    date: label(e.updated),
    title: label(e.title),
    content: label(e.content),
    voteSum: parseInt(label(e["im:voteSum"]) || "0", 10) || 0,
    voteCount: parseInt(label(e["im:voteCount"]) || "0", 10) || 0,
  };
}

function appNameFromFeed(feed) {
  const entries = asArray(feed && feed.entry);
  const header = entries.find((e) => e && e["im:name"] && !e["im:rating"]);
  if (header) return label(header["im:name"]);
  return "";
}

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(appId, country, page, sortBy, attempts, fetchImpl) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(reviewsUrl(appId, country, page, sortBy), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        if (res.status === 404) return { entries: [], appName: "", fatal: true, status: 404 };
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const feed = data && data.feed;
      const entries = asArray(feed && feed.entry).map(normalizeEntry).filter(Boolean);
      const appName = appNameFromFeed(feed);
      if (entries.length > 0 || attempt === attempts) {
        return { entries, appName, fatal: false };
      }
    } catch (err) {
      if (attempt === attempts) return { entries: [], appName: "", fatal: false, error: String(err) };
    }
    await delay(300 * attempt);
  }
  return { entries: [], appName: "", fatal: false };
}

/**
 * Fetch every available review for an app.
 * @param {string} appId numeric App Store id
 * @param {object} opts { country, maxPages, attemptsPerPage, onProgress }
 * @returns {Promise<{appName, country, reviews, pagesFetched, truncatedAtCap}>}
 */
export async function fetchAllReviews(appId, opts = {}) {
  const {
    country = "kr",
    maxPages = 10,
    attemptsPerPage = 4,
    onProgress = () => {},
    fetchImpl = fetch,
  } = opts;

  const byId = new Map();
  let appName = "";
  let pagesFetched = 0;
  let consecutiveEmpty = 0;

  for (let page = 1; page <= maxPages; page++) {
    onProgress({ page, maxPages, collected: byId.size, phase: "fetching" });
    const { entries, appName: name, fatal, status } = await fetchPage(
      appId,
      country,
      page,
      "mostrecent",
      attemptsPerPage,
      fetchImpl
    );
    if (name && !appName) appName = name;
    if (fatal && status === 404) {
      throw new Error(`앱 ID ${appId} 를 ${country.toUpperCase()} 스토어에서 찾을 수 없습니다.`);
    }
    pagesFetched = page;

    if (entries.length === 0) {
      // One empty page can be flakiness; two in a row means we've hit the end.
      consecutiveEmpty += 1;
      if (consecutiveEmpty >= 2) break;
      continue;
    }
    consecutiveEmpty = 0;
    for (const r of entries) {
      if (r.id) byId.set(r.id, r);
    }
  }

  const reviews = Array.from(byId.values())
    .filter((r) => r.rating != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  onProgress({ page: pagesFetched, maxPages, collected: reviews.length, phase: "done" });

  return {
    appName,
    country,
    appId: String(appId),
    reviews,
    pagesFetched,
    // Apple hard-caps the public RSS at ~500 reviews; flag when we likely hit it.
    truncatedAtCap: reviews.length >= 480,
  };
}
