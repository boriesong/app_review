import React, { useState, useCallback, useEffect } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Theme } from "@astryxdesign/core";
import { neutralTheme } from "@astryxdesign/theme-neutral";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Badge } from "@astryxdesign/core/Badge";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";

import { fetchAllReviews } from "../engine/fetchReviews.js";
import { fetchAppInfo } from "../engine/fetchAppInfo.js";
import { analyzeReviews } from "../engine/analyze.js";
import { exportReviewsCsv, exportAnalysisCsv } from "./exportCsv.js";
import {
  RatingTrendChart,
  VolumeSentimentChart,
  RatingDistribution,
  SentimentDonut,
} from "./charts.jsx";

const COUNTRIES = [
  { value: "kr", label: "한국" },
  { value: "us", label: "미국" },
  { value: "jp", label: "일본" },
  { value: "gb", label: "영국" },
];

const SENTIMENT_META = {
  positive: { variant: "success", label: "긍정" },
  neutral: { variant: "neutral", label: "중립" },
  negative: { variant: "error", label: "부정" },
};

function MetricCard({ label, value, sub, tone }) {
  const color =
    tone === "positive" ? "var(--color-success)" : tone === "negative" ? "var(--color-error)" : "var(--color-text-primary)";
  return (
    <Card padding={4}>
      <VStack gap={1}>
        <Text type="supporting">{label}</Text>
        <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
        {sub ? <Text type="supporting">{sub}</Text> : null}
      </VStack>
    </Card>
  );
}

function SectionHeading({ children, hint }) {
  return (
    <VStack gap={0.5}>
      <Heading level={2}>{children}</Heading>
      {hint ? <Text type="supporting">{hint}</Text> : null}
    </VStack>
  );
}

function LegendDot({ color, label }) {
  return (
    <HStack gap={1} vAlign="center">
      <span style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: color, display: "inline-block" }} />
      <Text type="supporting">{label}</Text>
    </HStack>
  );
}

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toISOString().slice(0, 10);
}

const SEVERITY_META = {
  warning: { variant: "warning", dot: "warning" },
  info: { variant: "info", dot: "accent" },
};

const MODE_KEY = "review-analyzer:color-mode";
const MODES = ["light", "dark", "system"];

function loadMode() {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (MODES.includes(saved)) return saved;
  } catch {
    /* localStorage unavailable (private mode) — fall through to default */
  }
  return "system";
}

export default function App() {
  const [mode, setMode] = useState(loadMode);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* persistence is best-effort */
    }
  }, [mode]);

  return (
    <Theme theme={neutralTheme} mode={mode}>
      <Analyzer mode={mode} setMode={setMode} />
    </Theme>
  );
}

function Analyzer({ mode, setMode }) {
  const [appId, setAppId] = useState("921952362");
  const [country, setCountry] = useState("kr");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    const id = appId.trim().replace(/[^0-9]/g, "");
    if (!id) {
      setError("숫자로 된 App Store 앱 ID를 입력하세요. (예: 921952362)");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    setResult(null);
    setMeta(null);
    setProgress({ page: 0, maxPages: 10, collected: 0 });
    try {
      // App name/icon (JSONP) and reviews (RSS) fetch in parallel; app info is
      // best-effort and never blocks or fails the analysis.
      const appInfoPromise = fetchAppInfo(id, country).catch(() => null);
      const fetched = await fetchAllReviews(id, {
        country,
        onProgress: (p) => setProgress(p),
      });
      const appInfo = await appInfoPromise;
      if (!fetched.reviews.length) {
        setError(
          `리뷰를 찾지 못했습니다. 앱 ID(${id}) 또는 스토어 국가(${country.toUpperCase()})를 확인하세요. Apple RSS 피드가 일시적으로 비어 반환될 수도 있으니 다시 시도해 보세요.`
        );
        setStatus("error");
        return;
      }
      const analysis = analyzeReviews(fetched.reviews);
      setResult(analysis);
      setMeta({
        appName: (appInfo && appInfo.name) || fetched.appName || "",
        appInfo: appInfo || null,
        appId: fetched.appId,
        country: fetched.country,
        pagesFetched: fetched.pagesFetched,
        truncatedAtCap: fetched.truncatedAtCap,
      });
      setStatus("done");
    } catch (e) {
      setError(String(e.message || e));
      setStatus("error");
    }
  }, [appId, country]);

  // variant="wash": no nav here, so the default "elevated" would paint a
  // content-height white panel on a wash background and leave a visible seam
  // below the fold — especially in light mode.
  return (
    <AppShell contentPadding={0} height="auto" variant="wash">
      <VStack gap={6} padding={6} maxWidth={1120} width="100%" style={{ marginInline: "auto" }}>
        {/* Header */}
        <HStack gap={4} justify="between" vAlign="start" wrap="wrap">
          <VStack gap={1}>
            <Heading level={1}>App Store 리뷰 분석기</Heading>
            <Text type="large" color="secondary">
              앱 ID를 입력하면 등록된 리뷰를 수집해 기간별 평점 변화 · 긍부정 · 내용 그루핑 · 이벤트 흔적 · 인사이트를 분석합니다.
            </Text>
          </VStack>
          <ModeToggle mode={mode} setMode={setMode} />
        </HStack>

        {/* Input */}
        <Card padding={5}>
          <VStack gap={4}>
            <Grid columns={{ minWidth: 240, repeat: "fit" }} gap={4} align="end">
              <TextInput
                label="App Store 앱 ID"
                value={appId}
                onChange={setAppId}
                placeholder="예: 921952362"
                description="앱스토어 URL의 id 뒤 숫자"
                startIcon="search"
              />
              <VStack gap={1}>
                <Text type="label">스토어 국가</Text>
                <SegmentedControl value={country} onChange={setCountry} label="스토어 국가" layout="fill">
                  {COUNTRIES.map((c) => (
                    <SegmentedControlItem key={c.value} value={c.value} label={c.label} />
                  ))}
                </SegmentedControl>
              </VStack>
            </Grid>
            <HStack gap={3} vAlign="center" wrap="wrap">
              <Button
                label="리뷰 분석"
                variant="primary"
                clickAction={run}
                isLoading={status === "loading"}
              />
              <Text type="supporting">
                Apple 공개 RSS는 앱당 최근 약 500건까지 제공합니다.
              </Text>
            </HStack>
          </VStack>
        </Card>

        {status === "loading" && progress ? (
          <Card padding={5}>
            <VStack gap={3} hAlign="center">
              <Spinner size="lg" label={`리뷰 수집 중… ${progress.page}/${progress.maxPages} 페이지 · ${progress.collected}건`} />
              <div style={{ width: "100%", maxWidth: 420 }}>
                <ProgressBar label="수집 진행률" value={progress.page} max={progress.maxPages} />
              </div>
            </VStack>
          </Card>
        ) : null}

        {status === "error" ? (
          <Banner variant="error" title="분석을 완료하지 못했습니다" description={error} />
        ) : null}

        {status === "done" && result && meta ? (
          <Results result={result} meta={meta} />
        ) : null}

        {status === "idle" ? (
          <EmptyState
            title="앱 ID를 입력하고 '리뷰 분석'을 누르세요"
            description="예시로 921952362 (KT 패밀리박스, 한국 스토어)가 입력되어 있습니다."
          />
        ) : null}
      </VStack>
    </AppShell>
  );
}

function Results({ result, meta }) {
  const { summary, monthly, topics, versions, events, insights, authenticity } = result;
  return (
    <VStack gap={8}>
      {/* App title header */}
      <HStack gap={3} vAlign="start" wrap="wrap" justify="between">
        <HStack gap={3} vAlign="center">
          {meta.appInfo && meta.appInfo.icon ? (
            <img
              src={meta.appInfo.icon}
              alt=""
              width={56}
              height={56}
              style={{ borderRadius: "var(--radius-container)", flexShrink: 0 }}
            />
          ) : null}
          <VStack gap={1}>
            {/* App name as the title, app ID directly beneath it */}
            <Heading level={2}>{meta.appName || `앱 ${meta.appId}`}</Heading>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge variant="neutral" label={`ID ${meta.appId}`} />
              <Badge variant="blue" label={meta.country.toUpperCase()} />
              {meta.appInfo && meta.appInfo.artist ? (
                <Text type="supporting">{meta.appInfo.artist}</Text>
              ) : null}
              {meta.appInfo && meta.appInfo.genre ? (
                <Text type="supporting">· {meta.appInfo.genre}</Text>
              ) : null}
            </HStack>
            <Text type="supporting">
              {fmtDate(summary.firstDate)} ~ {fmtDate(summary.lastDate)} · {meta.pagesFetched}페이지 수집
              {meta.truncatedAtCap ? " · Apple 500건 상한 도달(더 오래된 리뷰는 미제공)" : ""}
            </Text>
          </VStack>
        </HStack>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button
            label="리뷰 CSV"
            variant="secondary"
            icon={<Icon icon="arrowDown" />}
            onClick={() => exportReviewsCsv(result.reviews, meta)}
          />
          <Button
            label="분석 요약 CSV"
            variant="secondary"
            icon={<Icon icon="arrowDown" />}
            onClick={() => exportAnalysisCsv(result, meta)}
          />
        </HStack>
      </HStack>

      {/* Summary metrics */}
      <Grid columns={{ minWidth: 180, repeat: "fit" }} gap={4}>
        <MetricCard label="총 리뷰" value={`${summary.total}건`} />
        <MetricCard
          label="평균 평점"
          value={`${summary.avg}★`}
          tone={summary.avg >= 4 ? "positive" : summary.avg < 3 ? "negative" : undefined}
        />
        <MetricCard
          label="긍정 비율"
          value={`${Math.round((summary.positive / summary.total) * 100)}%`}
          sub={`${summary.positive}건`}
          tone="positive"
        />
        <MetricCard
          label="부정 비율"
          value={`${Math.round((summary.negative / summary.total) * 100)}%`}
          sub={`${summary.negative}건`}
          tone="negative"
        />
        <MetricCard label="분석 버전 수" value={`${versions.length}개`} sub={versions.map((v) => v.version).slice(0, 3).join(", ")} />
      </Grid>

      {/* Insights first — the takeaway */}
      <VStack gap={3}>
        <SectionHeading hint="위 데이터를 종합한 자동 인사이트">인사이트</SectionHeading>
        <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={3}>
          {insights.map((ins, i) => (
            <Card key={i} padding={4} variant="muted">
              <HStack gap={2} vAlign="start">
                <div style={{ marginTop: 4 }}>
                  <StatusDot
                    variant={ins.tone === "positive" ? "success" : ins.tone === "negative" ? "error" : "neutral"}
                    label={ins.tone}
                  />
                </div>
                <Text>{ins.text}</Text>
              </HStack>
            </Card>
          ))}
        </Grid>
      </VStack>

      <Divider />

      {/* Rating over time */}
      <VStack gap={4}>
        <SectionHeading hint="월별 평균 평점과 리뷰량·감정 구성">기간별 평점 변화</SectionHeading>
        <Grid columns={{ minWidth: 360, repeat: "fit" }} gap={4}>
          <Card padding={4}>
            <VStack gap={2}>
              <Text type="label">월별 평균 평점</Text>
              <RatingTrendChart monthly={monthly} />
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={3} justify="between" vAlign="center" wrap="wrap">
                <Text type="label">월별 리뷰 수 · 감정 구성</Text>
                <HStack gap={3} wrap="wrap">
                  <LegendDot color="var(--color-success)" label="긍정" />
                  <LegendDot color="var(--color-icon-gray)" label="중립" />
                  <LegendDot color="var(--color-error)" label="부정" />
                </HStack>
              </HStack>
              <VolumeSentimentChart monthly={monthly} />
            </VStack>
          </Card>
        </Grid>
      </VStack>

      <Divider />

      {/* Sentiment */}
      <VStack gap={4}>
        <SectionHeading hint="별점(1~5)과 텍스트 감정 분석 결합">긍정·부정 평가</SectionHeading>
        <Grid columns={{ minWidth: 300, repeat: "fit" }} gap={4}>
          <Card padding={4}>
            <VStack gap={3} hAlign="center">
              <Text type="label">긍부정 비율</Text>
              <SentimentDonut positive={summary.positive} neutral={summary.neutral} negative={summary.negative} />
              <HStack gap={3} wrap="wrap" justify="center">
                <LegendDot color="var(--color-success)" label={`긍정 ${summary.positive}`} />
                <LegendDot color="var(--color-icon-gray)" label={`중립 ${summary.neutral}`} />
                <LegendDot color="var(--color-error)" label={`부정 ${summary.negative}`} />
              </HStack>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={3}>
              <Text type="label">별점 분포</Text>
              <RatingDistribution dist={summary.dist} distPct={summary.distPct} total={summary.total} />
            </VStack>
          </Card>
        </Grid>
      </VStack>

      <Divider />

      {/* Topic grouping */}
      <VStack gap={4}>
        <SectionHeading hint="리뷰 텍스트를 주제별로 분류하고 감정을 집계">리뷰 내용 그루핑</SectionHeading>
        <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={4}>
          {topics.map((t) => (
            <TopicCard key={t.key} topic={t} />
          ))}
        </Grid>
      </VStack>

      <Divider />

      {/* Events */}
      <VStack gap={4}>
        <SectionHeading hint="평점 급락·리뷰 급증·버전 품질·이벤트성 리뷰 흔적 자동 탐지">리뷰 이벤트 흔적</SectionHeading>
        {events.length ? (
          <VStack gap={3}>
            {events.map((e, i) => {
              const sm = SEVERITY_META[e.severity] || SEVERITY_META.info;
              return (
                <Card key={i} padding={4}>
                  <HStack gap={3} vAlign="start">
                    <div style={{ marginTop: 4 }}>
                      <StatusDot variant={sm.dot} label={e.severity} />
                    </div>
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="semibold">{e.title}</Text>
                        <Badge variant={sm.variant} label={eventTypeLabel(e.type)} />
                      </HStack>
                      <Text type="supporting">{e.detail}</Text>
                    </VStack>
                  </HStack>
                </Card>
              );
            })}
          </VStack>
        ) : (
          <Card padding={4} variant="muted">
            <Text type="supporting">뚜렷한 이상 이벤트(평점 급락·리뷰 급증·이벤트성 리뷰 집중)는 발견되지 않았습니다.</Text>
          </Card>
        )}
        {authenticity.genericTotal > 0 ? (
          <Card padding={4} variant="muted">
            <Text type="supporting">
              참고: 짧은 정형 5★ 칭찬 리뷰가 {authenticity.genericTotal}건({authenticity.genericShare}%) 감지되었습니다. 리뷰 유도
              이벤트의 영향으로 실제 만족도보다 평점이 부풀려졌을 수 있습니다.
            </Text>
          </Card>
        ) : null}
      </VStack>

      <Divider />

      {/* Version table */}
      <VStack gap={4}>
        <SectionHeading hint="버전별 평균 평점과 부정 비중">버전별 평점</SectionHeading>
        <Card padding={0}>
          <VStack gap={0}>
            <VersionRow header />
            {versions.map((v) => (
              <VersionRow key={v.version} v={v} appAvg={summary.avg} />
            ))}
          </VStack>
        </Card>
      </VStack>

      <Divider />

      {/* Recent reviews */}
      <VStack gap={4}>
        <SectionHeading hint="최신순 · 감정 태그 포함">리뷰 원문 (최근 40건)</SectionHeading>
        <VStack gap={2}>
          {result.reviews.slice(0, 40).map((r) => (
            <ReviewRow key={r.id} r={r} />
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}

/* Sun / moon / monitor glyphs — not in the semantic icon registry, so passed as
   SVG components. `currentColor` lets Icon apply the active segment's color. */
const SunIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const SystemIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

function ModeToggle({ mode, setMode }) {
  return (
    <SegmentedControl value={mode} onChange={setMode} label="화면 모드" size="sm">
      <SegmentedControlItem value="light" label="라이트" icon={<Icon icon={SunIcon} />} />
      <SegmentedControlItem value="dark" label="다크" icon={<Icon icon={MoonIcon} />} />
      <SegmentedControlItem value="system" label="시스템" icon={<Icon icon={SystemIcon} />} />
    </SegmentedControl>
  );
}

function eventTypeLabel(type) {
  return (
    {
      volume_spike: "리뷰 급증",
      rating_drop: "평점 급락",
      version_impact: "버전 품질",
      incentivized_cluster: "이벤트성 리뷰",
    }[type] || type
  );
}

function TopicCard({ topic }) {
  const t = topic;
  const tone = t.avg >= 4 ? "success" : t.avg >= 3 ? "warning" : "error";
  const total = t.positive + t.neutral + t.negative || 1;
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} justify="between" vAlign="center">
          <Text weight="semibold">{t.label}</Text>
          <Badge variant="neutral" label={`${t.count}건 · ${t.share}%`} />
        </HStack>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="supporting">평균 {t.avg}★</Text>
          <StatusDot variant={tone} label={`평균 ${t.avg}점`} />
          <Text type="supporting">
            긍정 {t.positive} · 중립 {t.neutral} · 부정 {t.negative}
          </Text>
        </HStack>
        {/* mini sentiment bar */}
        <span style={{ display: "flex", height: 8, borderRadius: "var(--radius-full)", overflow: "hidden", background: "var(--color-background-muted)" }}>
          <span style={{ width: `${(t.positive / total) * 100}%`, background: "var(--color-success)" }} />
          <span style={{ width: `${(t.neutral / total) * 100}%`, background: "var(--color-icon-gray)" }} />
          <span style={{ width: `${(t.negative / total) * 100}%`, background: "var(--color-error)" }} />
        </span>
        {t.samples[0] ? (
          <VStack gap={0.5}>
            <Text type="supporting">대표 리뷰</Text>
            <Text type="body" maxLines={3}>
              “{t.samples[0].content || t.samples[0].title}”
            </Text>
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}

function VersionRow({ v, appAvg, header }) {
  const grid = { display: "grid", gridTemplateColumns: "1.2fr 1.6fr 0.7fr 0.9fr 0.9fr", alignItems: "center", gap: "var(--spacing-3)", padding: "var(--spacing-3) var(--spacing-4)" };
  if (header) {
    return (
      <div style={{ ...grid, borderBottom: "1px solid var(--color-border)" }}>
        <Text type="label">버전</Text>
        <Text type="label">기간</Text>
        <Text type="label">리뷰 수</Text>
        <Text type="label">평균 평점</Text>
        <Text type="label">부정 비중</Text>
      </div>
    );
  }
  const low = appAvg - v.avg >= 0.7;
  const period =
    v.firstSeen === v.lastSeen || fmtDate(v.firstSeen) === fmtDate(v.lastSeen)
      ? fmtDate(v.firstSeen)
      : `${fmtDate(v.firstSeen)} ~ ${fmtDate(v.lastSeen)}`;
  return (
    <div style={{ ...grid, borderBottom: "1px solid var(--color-border)" }}>
      <HStack gap={2} vAlign="center">
        <Text weight="medium">{v.version}</Text>
        {low ? <Badge variant="warning" label="저평점" /> : null}
      </HStack>
      <Text type="supporting" hasTabularNumbers>{period}</Text>
      <Text hasTabularNumbers>{v.count}</Text>
      <Text hasTabularNumbers>{v.avg}★</Text>
      <Text hasTabularNumbers>{v.negativeShare}%</Text>
    </div>
  );
}

function ReviewRow({ r }) {
  const sm = SENTIMENT_META[r.sentiment];
  return (
    <Card padding={4}>
      <VStack gap={1.5}>
        <HStack gap={2} vAlign="center" wrap="wrap" justify="between">
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold" hasTabularNumbers>
              {"★".repeat(r.rating)}
              <span style={{ color: "var(--color-text-disabled)" }}>{"★".repeat(5 - r.rating)}</span>
            </Text>
            <Text weight="medium">{r.title}</Text>
            <Badge variant={sm.variant} label={sm.label} />
            {r.mismatch ? <Badge variant="warning" label="평점·내용 불일치" /> : null}
          </HStack>
          <Text type="supporting">
            {fmtDate(r.date)} · v{r.version || "-"}
          </Text>
        </HStack>
        {r.content ? <Text color="secondary">{r.content}</Text> : null}
        <HStack gap={2} vAlign="center" wrap="wrap">
          {r.author ? <Text type="supporting">{r.author}</Text> : null}
          {r.topics.length ? <Text type="supporting">· {r.topics.length}개 주제</Text> : null}
        </HStack>
      </VStack>
    </Card>
  );
}
