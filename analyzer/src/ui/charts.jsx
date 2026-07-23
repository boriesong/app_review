import React from "react";

// Lightweight SVG charts styled with Astryx CSS variables. No external chart
// library — keeps the bundle small and CSP-safe. All colors come from tokens.

const AXIS = "var(--color-border)";
const GRID = "var(--color-border)";
const LABEL = "var(--color-text-secondary)";

// ---- Rating trend line chart (avg rating per month, 1..5) ----

export function RatingTrendChart({ monthly, height = 220 }) {
  const width = 640;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const iw = width - padL - padR;
  const ih = height - padT - padB;

  if (!monthly.length) return null;

  const yMin = 1;
  const yMax = 5;
  const n = monthly.length;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => padT + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const linePath = monthly
    .map((m, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(m.avg).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${x(n - 1).toFixed(1)} ${(padT + ih).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + ih).toFixed(1)} Z`;

  // With many months, per-point labels/dots overlap. Thin them out.
  const dense = n > 14;
  const xLabelEvery = Math.max(1, Math.ceil(n / 12));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="기간별 평균 평점 추이">
      {[1, 2, 3, 4, 5].map((g) => (
        <g key={g}>
          <line x1={padL} x2={width - padR} y1={y(g)} y2={y(g)} stroke={GRID} strokeWidth="1" opacity="0.4" />
          <text x={padL - 8} y={y(g) + 4} fontSize="11" fill={LABEL} textAnchor="end">
            {g}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="var(--color-accent)" opacity="0.10" />
      <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {monthly.map((m, i) => {
        const showX = i % xLabelEvery === 0 || i === n - 1;
        return (
          <g key={m.month}>
            <circle cx={x(i)} cy={y(m.avg)} r={dense ? 2 : 4} fill="var(--color-accent)" stroke="var(--color-background-card)" strokeWidth={dense ? 0.75 : 1.5} />
            {!dense ? (
              <text x={x(i)} y={y(m.avg) - 10} fontSize="10" fill="var(--color-text-primary)" textAnchor="middle" fontWeight="600">
                {m.avg.toFixed(1)}
              </text>
            ) : null}
            {showX ? (
              <text x={x(i)} y={height - 12} fontSize="10" fill={LABEL} textAnchor="middle">
                {m.month.slice(2)}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={padL} x2={width - padR} y1={padT + ih} y2={padT + ih} stroke={AXIS} strokeWidth="1" />
    </svg>
  );
}

// ---- Monthly volume + sentiment stacked bars ----

export function VolumeSentimentChart({ monthly, height = 200 }) {
  const width = 640;
  const padL = 30;
  const padR = 16;
  const padT = 12;
  const padB = 30;
  const iw = width - padL - padR;
  const ih = height - padT - padB;
  if (!monthly.length) return null;

  const maxCount = Math.max(...monthly.map((m) => m.count), 1);
  const n = monthly.length;
  const slot = iw / n;
  const barW = Math.min(slot * 0.6, 46);
  const yScale = (v) => (v / maxCount) * ih;
  const dense = n > 14;
  const xLabelEvery = Math.max(1, Math.ceil(n / 12));

  const seg = [
    { key: "positive", color: "var(--color-success)" },
    { key: "neutral", color: "var(--color-icon-gray)" },
    { key: "negative", color: "var(--color-error)" },
  ];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="월별 리뷰 수와 긍부정 구성">
      <line x1={padL} x2={width - padR} y1={padT + ih} y2={padT + ih} stroke={AXIS} strokeWidth="1" />
      {monthly.map((m, i) => {
        const cx = padL + slot * i + slot / 2;
        const showX = i % xLabelEvery === 0 || i === n - 1;
        let yCursor = padT + ih;
        return (
          <g key={m.month}>
            {seg.map((s) => {
              const h = yScale(m[s.key]);
              yCursor -= h;
              return h > 0 ? (
                <rect key={s.key} x={cx - barW / 2} y={yCursor} width={Math.max(barW, 1)} height={h} fill={s.color} rx={dense ? 0.5 : 2} />
              ) : null;
            })}
            {!dense ? (
              <text x={cx} y={padT + ih - yScale(m.count) - 5} fontSize="10" fill="var(--color-text-primary)" textAnchor="middle" fontWeight="600">
                {m.count}
              </text>
            ) : null}
            {showX ? (
              <text x={cx} y={height - 10} fontSize="10" fill={LABEL} textAnchor="middle">
                {m.month.slice(2)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Rating distribution horizontal bars (5★..1★) ----

export function RatingDistribution({ dist, distPct, total }) {
  const colorFor = (star) =>
    star >= 4 ? "var(--color-success)" : star === 3 ? "var(--color-warning)" : "var(--color-error)";
  return (
    <div>
      {[5, 4, 3, 2, 1].map((star) => (
        <div
          key={star}
          style={{
            display: "grid",
            gridTemplateColumns: "38px 1fr 92px",
            alignItems: "center",
            gap: "var(--spacing-2)",
            marginBottom: "var(--spacing-1-5)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            {star}★
          </span>
          <span
            style={{
              display: "block",
              height: 10,
              background: "var(--color-background-muted)",
              borderRadius: "var(--radius-full)",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${distPct[star]}%`,
                background: colorFor(star),
                borderRadius: "var(--radius-full)",
              }}
            />
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {dist[star]}건 · {distPct[star]}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Sentiment donut ----

export function SentimentDonut({ positive, neutral, negative, size = 132 }) {
  const total = positive + neutral + negative || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const segs = [
    { v: positive, color: "var(--color-success)" },
    { v: neutral, color: "var(--color-icon-gray)" },
    { v: negative, color: "var(--color-error)" },
  ];
  let offset = 0;
  const posPct = Math.round((positive / total) * 100);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="긍부정 비율">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-background-muted)" strokeWidth="14" />
      {segs.map((s, i) => {
        const len = (s.v / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="47%" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--color-text-primary)">
        {posPct}%
      </text>
      <text x="50%" y="63%" textAnchor="middle" fontSize="11" fill="var(--color-text-secondary)">
        긍정
      </text>
    </svg>
  );
}
