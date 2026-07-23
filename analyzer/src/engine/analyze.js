import { POSITIVE_WORDS, NEGATIVE_WORDS, TOPICS, GENERIC_PRAISE } from "./lexicon.js";

// ---------- helpers ----------

const containsAny = (text, words) => words.some((w) => text.includes(w));
const countMatches = (text, words) => words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function weekKey(date) {
  const d = new Date(date);
  const onejan = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}
const round = (n, p = 2) => {
  const f = Math.pow(10, p);
  return Math.round(n * f) / f;
};
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

// ---------- per-review classification ----------

export function classifyReview(review) {
  const text = `${review.title} ${review.content}`.toLowerCase();
  const posHits = countMatches(text, POSITIVE_WORDS);
  const negHits = countMatches(text, NEGATIVE_WORDS);

  // Rating is the ground-truth sentiment.
  let ratingSentiment = "neutral";
  if (review.rating >= 4) ratingSentiment = "positive";
  else if (review.rating <= 2) ratingSentiment = "negative";

  // Text-derived sentiment from the lexicon.
  let textSentiment = "neutral";
  if (negHits > posHits) textSentiment = "negative";
  else if (posHits > negHits) textSentiment = "positive";

  // Final sentiment: trust the rating, but let strong negative text override a
  // high rating (the classic "5 stars but please fix login" review).
  let sentiment = ratingSentiment;
  const mismatch =
    (ratingSentiment === "positive" && textSentiment === "negative" && negHits >= 2) ||
    (ratingSentiment === "negative" && textSentiment === "positive" && posHits >= 2 && negHits === 0);
  if (mismatch) sentiment = textSentiment;

  const topics = TOPICS.filter((t) => containsAny(text, t.keywords)).map((t) => t.key);

  const contentLen = review.content.trim().length;
  const isGenericPraise =
    review.rating === 5 &&
    contentLen <= 20 &&
    (containsAny(text, GENERIC_PRAISE) || review.title.trim() === review.content.trim());

  return { ...review, sentiment, ratingSentiment, textSentiment, mismatch, topics, isGenericPraise };
}

// ---------- rating trend over time ----------

function buildMonthly(reviews) {
  const map = new Map();
  for (const r of reviews) {
    const k = monthKey(r.date);
    if (!map.has(k)) map.set(k, { month: k, ratings: [], positive: 0, negative: 0, neutral: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    const m = map.get(k);
    m.ratings.push(r.rating);
    m.dist[r.rating] += 1;
    m[r.sentiment] += 1;
  }
  return Array.from(map.values())
    .map((m) => ({
      month: m.month,
      count: m.ratings.length,
      avg: round(mean(m.ratings), 2),
      positive: m.positive,
      negative: m.negative,
      neutral: m.neutral,
      dist: m.dist,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ---------- summary ----------

function buildSummary(reviews) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) dist[r.rating] += 1;
  const total = reviews.length;
  const avg = round(mean(reviews.map((r) => r.rating)), 2);
  const dates = reviews.map((r) => new Date(r.date)).sort((a, b) => a - b);
  const distPct = {};
  for (let s = 1; s <= 5; s++) distPct[s] = total ? round((dist[s] / total) * 100, 1) : 0;
  return {
    total,
    avg,
    dist,
    distPct,
    positive: reviews.filter((r) => r.sentiment === "positive").length,
    negative: reviews.filter((r) => r.sentiment === "negative").length,
    neutral: reviews.filter((r) => r.sentiment === "neutral").length,
    firstDate: dates.length ? dates[0].toISOString() : null,
    lastDate: dates.length ? dates[dates.length - 1].toISOString() : null,
  };
}

// ---------- topic grouping ----------

function buildTopics(reviews) {
  const out = TOPICS.map((t) => {
    const matched = reviews.filter((r) => r.topics.includes(t.key));
    const ratings = matched.map((r) => r.rating);
    const samples = matched
      .slice()
      .sort((a, b) => b.voteSum - a.voteSum || b.content.length - a.content.length)
      .slice(0, 3)
      .map((r) => ({ rating: r.rating, title: r.title, content: r.content, date: r.date }));
    return {
      key: t.key,
      label: t.label,
      polarity: t.polarity,
      count: matched.length,
      share: reviews.length ? round((matched.length / reviews.length) * 100, 1) : 0,
      avg: round(mean(ratings), 2),
      positive: matched.filter((r) => r.sentiment === "positive").length,
      negative: matched.filter((r) => r.sentiment === "negative").length,
      neutral: matched.filter((r) => r.sentiment === "neutral").length,
      samples,
    };
  }).filter((t) => t.count > 0);
  return out.sort((a, b) => b.count - a.count);
}

// ---------- version impact ----------

function buildVersions(reviews) {
  const map = new Map();
  for (const r of reviews) {
    const v = r.version || "미상";
    if (!map.has(v)) map.set(v, []);
    map.get(v).push(r);
  }
  return Array.from(map.entries())
    .map(([version, rs]) => {
      const sortedDates = rs.map((r) => r.date).sort();
      return {
        version,
        count: rs.length,
        avg: round(mean(rs.map((r) => r.rating)), 2),
        negativeShare: round((rs.filter((r) => r.sentiment === "negative").length / rs.length) * 100, 1),
        firstSeen: sortedDates[0],
        lastSeen: sortedDates[sortedDates.length - 1],
      };
    })
    .sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen));
}

// ---------- event / anomaly detection ----------

function detectEvents(reviews, monthly, versions) {
  const events = [];

  // 1) Volume spikes: months whose review count is a statistical outlier.
  if (monthly.length >= 3) {
    const counts = monthly.map((m) => m.count);
    const m = mean(counts);
    const sd = stdev(counts);
    const med = counts.slice().sort((a, b) => a - b)[Math.floor(counts.length / 2)];
    for (const mo of monthly) {
      if ((sd > 0 && mo.count > m + 2 * sd) || mo.count > Math.max(med * 2.5, med + 3)) {
        events.push({
          type: "volume_spike",
          severity: "info",
          month: mo.month,
          title: `${mo.month} 리뷰 급증`,
          detail: `이 달 리뷰 ${mo.count}건 (평균 ${round(m, 1)}건 대비 급증). 업데이트·프로모션·이슈 발생 가능성.`,
          value: mo.count,
        });
      }
    }
  }

  // 2) Rating drops month over month, correlated with a new version.
  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1];
    const cur = monthly[i];
    if (prev.count >= 3 && cur.count >= 3 && prev.avg - cur.avg >= 1.0) {
      events.push({
        type: "rating_drop",
        severity: "warning",
        month: cur.month,
        title: `${cur.month} 평점 급락`,
        detail: `평균 평점이 ${prev.avg} → ${cur.avg} 로 하락 (${round(prev.avg - cur.avg, 1)}점↓). 부정 리뷰 ${cur.negative}건.`,
        value: round(prev.avg - cur.avg, 2),
      });
    }
  }

  // 3) Versions with a notably low rating vs the app average — surface only the
  //    3 worst here to avoid noise (the full list is in the version table).
  const overallAvg = mean(reviews.map((r) => r.rating));
  versions
    .filter((v) => v.count >= 3 && overallAvg - v.avg >= 0.7)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .forEach((v) => {
      events.push({
        type: "version_impact",
        severity: "warning",
        version: v.version,
        title: `버전 ${v.version} 품질 저하 의심`,
        detail: `이 버전 평균 ${v.avg}점 (전체 ${round(overallAvg, 2)}점 대비 낮음), 부정 비중 ${v.negativeShare}%.`,
        value: round(overallAvg - v.avg, 2),
      });
    });

  // 4) Incentivized / event-driven review clusters: weeks with a burst of
  //    ultra-short 5★ generic-praise reviews.
  const genericByWeek = new Map();
  for (const r of reviews) {
    if (!r.isGenericPraise) continue;
    const k = weekKey(r.date);
    genericByWeek.set(k, (genericByWeek.get(k) || 0) + 1);
  }
  const genericTotal = reviews.filter((r) => r.isGenericPraise).length;
  const genericShare = reviews.length ? round((genericTotal / reviews.length) * 100, 1) : 0;
  for (const [week, n] of genericByWeek) {
    if (n >= 4) {
      events.push({
        type: "incentivized_cluster",
        severity: "info",
        week,
        title: `${week} 이벤트성 리뷰 흔적`,
        detail: `짧은 5★ 정형 칭찬 리뷰가 ${n}건 집중. 앱 내 리뷰 유도·이벤트 가능성.`,
        value: n,
      });
    }
  }

  events.sort((a, b) => {
    const order = { warning: 0, info: 1 };
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    return String(b.month || b.week || b.version || "").localeCompare(String(a.month || a.week || a.version || ""));
  });

  return { events, genericShare, genericTotal };
}

// ---------- linear trend slope (rating over time) ----------

function trendSlope(monthly) {
  const pts = monthly.filter((m) => m.count > 0).map((m, i) => [i, m.avg]);
  if (pts.length < 2) return 0;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < pts.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : round(num / den, 3);
}

// ---------- insight generation ----------

function buildInsights({ summary, monthly, topics, versions, eventInfo }) {
  const insights = [];
  const slope = trendSlope(monthly);

  // Overall health
  const skew = summary.distPct[5] + summary.distPct[4] - summary.distPct[1] - summary.distPct[2];
  insights.push({
    kind: "health",
    tone: summary.avg >= 4 ? "positive" : summary.avg >= 3 ? "neutral" : "negative",
    text: `전체 ${summary.total}건 · 평균 ${summary.avg}점. 긍정 ${summary.positive}건 / 부정 ${summary.negative}건 (긍정-부정 격차 ${round(skew, 1)}%p).`,
  });

  // Trend direction
  if (monthly.length >= 3) {
    const dir = slope > 0.08 ? "개선" : slope < -0.08 ? "악화" : "정체";
    const tone = dir === "개선" ? "positive" : dir === "악화" ? "negative" : "neutral";
    insights.push({
      kind: "trend",
      tone,
      text: `기간별 평점 추세는 '${dir}' (월별 회귀 기울기 ${slope}). ${monthly[0].month} ${monthly[0].avg}점 → ${monthly[monthly.length - 1].month} ${monthly[monthly.length - 1].avg}점.`,
    });
  }

  // Top complaint topics (negative-leaning, ranked by negative volume)
  const complaints = topics
    .filter((t) => t.negative > 0 && (t.polarity === "negative" || t.avg < 3.5))
    .sort((a, b) => b.negative - a.negative)
    .slice(0, 3);
  if (complaints.length) {
    insights.push({
      kind: "complaints",
      tone: "negative",
      text: `주요 불만: ${complaints.map((t) => `${t.label}(부정 ${t.negative}건·평균 ${t.avg}점)`).join(", ")}.`,
    });
  }

  // Top praise
  const praise = topics
    .filter((t) => t.positive > 0 && t.avg >= 4)
    .sort((a, b) => b.positive - a.positive)
    .slice(0, 2);
  if (praise.length) {
    insights.push({
      kind: "praise",
      tone: "positive",
      text: `핵심 강점: ${praise.map((t) => `${t.label}(긍정 ${t.positive}건)`).join(", ")}. 마케팅·유지 포인트로 활용 가능.`,
    });
  }

  // Version impact
  const worstVersion = versions
    .filter((v) => v.count >= 3)
    .sort((a, b) => a.avg - b.avg)[0];
  if (worstVersion && summary.avg - worstVersion.avg >= 0.5) {
    insights.push({
      kind: "version",
      tone: "negative",
      text: `버전 ${worstVersion.version} 출시 후 평점이 상대적으로 낮음(${worstVersion.avg}점, 부정 ${worstVersion.negativeShare}%). 회귀 여부 점검 필요.`,
    });
  }

  // Event-review signal
  if (eventInfo.genericShare >= 25) {
    insights.push({
      kind: "authenticity",
      tone: "neutral",
      text: `짧은 정형 5★ 칭찬 리뷰가 전체의 ${eventInfo.genericShare}% (${eventInfo.genericTotal}건). 리뷰 유도 이벤트 영향이 크므로 평점 해석 시 가중치 보정 권장.`,
    });
  }

  return { insights, slope };
}

// ---------- main entry ----------

export function analyzeReviews(rawReviews) {
  const reviews = rawReviews.map(classifyReview);
  const summary = buildSummary(reviews);
  const monthly = buildMonthly(reviews);
  const topics = buildTopics(reviews);
  const versions = buildVersions(reviews);
  const { events, genericShare, genericTotal } = detectEvents(reviews, monthly, versions);
  const { insights, slope } = buildInsights({
    summary,
    monthly,
    topics,
    versions,
    eventInfo: { genericShare, genericTotal },
  });

  return {
    summary,
    monthly,
    topics,
    versions,
    events,
    insights,
    trendSlope: slope,
    authenticity: { genericShare, genericTotal },
    reviews,
  };
}
