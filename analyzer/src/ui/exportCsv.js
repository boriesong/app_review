import { TOPICS } from "../engine/lexicon.js";

const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));
const SENTIMENT_LABEL = { positive: "긍정", neutral: "중립", negative: "부정" };

// RFC-4180 field escaping.
function esc(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const head = headers.map(esc).join(",");
  const body = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return `${head}\r\n${body}`;
}

// Trigger a browser download of a UTF-8 (BOM'd, so Excel reads Korean) CSV.
function download(filename, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function baseName(meta) {
  const app = (meta.appName || `app_${meta.appId}`).replace(/[^\w가-힣.-]+/g, "_").slice(0, 40);
  return `${app}_${meta.country}`;
}

// ---- 1) All reviews with classification ----
export function exportReviewsCsv(reviews, meta) {
  const headers = [
    "번호",
    "날짜",
    "평점",
    "버전",
    "작성자",
    "감정",
    "평점·내용불일치",
    "짧은정형5★",
    "주제",
    "제목",
    "내용",
  ];
  const rows = reviews.map((r, i) => [
    i + 1,
    fmtDate(r.date),
    r.rating,
    r.version || "",
    r.author || "",
    SENTIMENT_LABEL[r.sentiment] || r.sentiment,
    r.mismatch ? "Y" : "",
    r.isGenericPraise ? "Y" : "",
    r.topics.map((k) => TOPIC_LABEL[k] || k).join(" / "),
    r.title || "",
    r.content || "",
  ]);
  download(`${baseName(meta)}_reviews.csv`, toCsv(headers, rows));
}

// ---- 2) Analysis summary (monthly trend + topics + versions in one sheet) ----
export function exportAnalysisCsv(result, meta) {
  const sections = [];

  sections.push(["# 요약"]);
  sections.push(["앱", meta.appName || meta.appId]);
  sections.push(["앱 ID", meta.appId]);
  sections.push(["국가", meta.country.toUpperCase()]);
  sections.push(["총 리뷰", result.summary.total]);
  sections.push(["평균 평점", result.summary.avg]);
  sections.push(["긍정", result.summary.positive]);
  sections.push(["중립", result.summary.neutral]);
  sections.push(["부정", result.summary.negative]);
  sections.push([]);

  sections.push(["# 기간별 평점 변화 (월별)"]);
  sections.push(["월", "리뷰수", "평균평점", "긍정", "중립", "부정"]);
  result.monthly.forEach((m) =>
    sections.push([m.month, m.count, m.avg, m.positive, m.neutral, m.negative])
  );
  sections.push([]);

  sections.push(["# 리뷰 내용 그루핑 (주제)"]);
  sections.push(["주제", "건수", "비중(%)", "평균평점", "긍정", "중립", "부정"]);
  result.topics.forEach((t) =>
    sections.push([t.label, t.count, t.share, t.avg, t.positive, t.neutral, t.negative])
  );
  sections.push([]);

  sections.push(["# 버전별 평점"]);
  sections.push(["버전", "리뷰수", "평균평점", "부정비중(%)", "기간시작", "기간종료"]);
  result.versions.forEach((v) =>
    sections.push([v.version, v.count, v.avg, v.negativeShare, fmtDate(v.firstSeen), fmtDate(v.lastSeen)])
  );
  sections.push([]);

  sections.push(["# 리뷰 이벤트 흔적"]);
  sections.push(["유형", "심각도", "제목", "설명"]);
  result.events.forEach((e) => sections.push([e.type, e.severity, e.title, e.detail]));
  sections.push([]);

  sections.push(["# 인사이트"]);
  sections.push(["구분", "내용"]);
  result.insights.forEach((ins) => sections.push([ins.kind, ins.text]));

  const csv = sections.map((row) => row.map(esc).join(",")).join("\r\n");
  download(`${baseName(meta)}_analysis.csv`, csv);
}
