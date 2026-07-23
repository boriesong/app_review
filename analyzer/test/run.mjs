import { analyzeReviews } from "../src/engine/analyze.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(join(here, "sample_page3.json"), "utf8"));
const label = (n) => (n && n.label != null ? n.label : "");
const reviews = (d.feed.entry || [])
  .filter((e) => e["im:rating"])
  .map((e) => ({
    id: label(e.id),
    author: label(e.author && e.author.name),
    rating: parseInt(label(e["im:rating"]), 10),
    version: label(e["im:version"]),
    date: label(e.updated),
    title: label(e.title),
    content: label(e.content),
    voteSum: 0,
    voteCount: 0,
  }));

const a = analyzeReviews(reviews);
console.log("SUMMARY", JSON.stringify(a.summary));
console.log("MONTHLY", JSON.stringify(a.monthly.map((m) => ({ m: m.month, c: m.count, avg: m.avg, neg: m.negative }))));
console.log("TOPICS", JSON.stringify(a.topics.map((t) => ({ t: t.label, c: t.count, avg: t.avg, pos: t.positive, neg: t.negative }))));
console.log("VERSIONS", JSON.stringify(a.versions));
console.log("EVENTS");
a.events.forEach((e) => console.log("  [" + e.severity + "]", e.title, "::", e.detail));
console.log("AUTH", JSON.stringify(a.authenticity));
console.log("INSIGHTS");
a.insights.forEach((i) => console.log("  (" + i.tone + ")", i.text));
