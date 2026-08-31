/* ==========================================================================
   scripts/lib.js — shared helpers for the publishing automation.

   Pure Node, no dependencies (matches the rest of the site). Used by:
     scripts/issue-to-post.js   turn a submitted form into a news post
     scripts/discover-news.js   find fresh news and queue it for review

   Nothing in here runs on the website. It runs inside GitHub Actions.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NEWS_SRC = path.join(ROOT, "content", "news");

/* --------------------------------------------------------------------------
   Text helpers
   -------------------------------------------------------------------------- */

// Turn "Hulsey: Town Hall in Helena!" into "hulsey-town-hall-in-helena".
// Always returns something matching ^[a-z0-9-]+$ so it can never write a file
// outside content/news/ (no slashes, dots or spaces survive).
function slugify(input) {
  const base = String(input || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
  if (base) return base;
  // Fallback for a title that was all punctuation/emoji.
  return "post-" + new Date().toISOString().slice(0, 10);
}

// A YAML-safe scalar for the front-matter block. build-news.js understands a
// double-quoted JSON string, so quoting anything with a colon, hash or quote
// keeps titles like "Hulsey: Session Recap" working.
function fmValue(value) {
  const s = String(value == null ? "" : value).replace(/\r?\n/g, " ").trim();
  if (s === "") return '""';
  // Leave a plain value unquoted (e.g. Legislation, In the News, 2026-04-09);
  // quote anything with a character YAML treats specially.
  if (/^[A-Za-z0-9][A-Za-z0-9 ._/()-]*$/.test(s)) return s;
  return JSON.stringify(s); // valid double-quoted string build-news.js can read
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/\s+/g, " ")
    .trim();
}

// Cut a long string to a sentence-ish length without chopping a word in half.
function trimTo(s, max) {
  const text = String(s || "").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch (e) { return ""; }
}

function isoDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt) ? "" : dt.toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

/* --------------------------------------------------------------------------
   GitHub Issue Form parsing

   A submitted issue form renders in the issue body as:

       ### Field label

       the value

       ### Next field label

       _No response_

   parseIssueForm returns a map of { "field label (lowercased)": "value" }.
   getField reads the first non-empty match from a list of accepted labels.

   It splits ONLY on the known field labels (FORM_LABELS). That matters because
   a post's own text can contain "## Headings", which must stay part of the
   value instead of being mistaken for a new field.
   -------------------------------------------------------------------------- */
const FORM_LABELS = [
  "Headline",
  "Date (YYYY-MM-DD)",
  "Category",
  "Other category (only if you picked Other)",
  "One-sentence summary",
  "Post text",
  "Draft?",
  "News link (URL)",
  "Headline to show (optional)",
  "Why it matters (optional)",
];

function parseIssueForm(body, knownLabels) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const labels = (knownLabels && knownLabels.length ? knownLabels : FORM_LABELS)
    .map(function (l) { return l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
  const re = new RegExp("^#{2,3}[ \\t]+(" + labels.join("|") + ")[ \\t]*$", "gim");

  const marks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    marks.push({ label: m[1].trim().toLowerCase(), valueStart: re.lastIndex, headStart: m.index });
  }

  const fields = {};
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].headStart : text.length;
    let value = text.slice(marks[i].valueStart, end).trim();
    if (/^_no response_$/i.test(value)) value = "";
    fields[marks[i].label] = value;
  }
  return fields;
}

function getField(fields, labels) {
  for (const label of labels) {
    const key = String(label).toLowerCase();
    if (fields[key] && fields[key].trim()) return fields[key].trim();
  }
  return "";
}

// A checkbox field renders its ticked options as "- [x] ...". True if any tick.
function isChecked(value) {
  return /- \[x\]/i.test(String(value || ""));
}

/* --------------------------------------------------------------------------
   Fetching a page and reading its social/preview tags
   -------------------------------------------------------------------------- */
const USER_AGENT =
  "Mozilla/5.0 (compatible; HulseyForHouseBot/1.0; +https://hulseyforhouse.com)";

async function fetchPage(url, opts) {
  opts = opts || {};
  const timeoutMs = opts.timeoutMs || 12000;
  const maxBytes = opts.maxBytes || 1500000;
  if (!/^https?:\/\//i.test(url)) throw new Error("Only http(s) links are allowed.");

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    const finalUrl = res.url || url;
    let html = "";
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      let received = 0;
      const chunks = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        received += step.value.length;
        chunks.push(Buffer.from(step.value));
        if (received > maxBytes) { try { await reader.cancel(); } catch (e) {} break; }
      }
      html = Buffer.concat(chunks).toString("utf8");
    } else {
      html = (await res.text()).slice(0, maxBytes);
    }
    return { ok: res.ok, status: res.status, finalUrl: finalUrl, html: html };
  } finally {
    clearTimeout(timer);
  }
}

function findMeta(html, key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attr = '(?:property|name|itemprop)=["\']' + k + '["\']';
  let m =
    new RegExp("<meta[^>]+" + attr + "[^>]*>", "i").exec(html) ||
    new RegExp('<meta[^>]*content=["\'][\\s\\S]*?["\'][^>]*' + attr, "i").exec(html);
  if (!m) return "";
  const tag = m[0];
  const c = /content=["']([\s\S]*?)["']/i.exec(tag);
  return c ? decodeEntities(c[1]) : "";
}

// Pull a clean title / description / source / date out of an article page.
function extractMeta(html, url) {
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title =
    findMeta(html, "og:title") ||
    findMeta(html, "twitter:title") ||
    (titleTag ? decodeEntities(titleTag[1]) : "") ||
    hostname(url);

  const description =
    findMeta(html, "og:description") ||
    findMeta(html, "twitter:description") ||
    findMeta(html, "description") ||
    "";

  const siteName = findMeta(html, "og:site_name") || hostname(url);

  const rawDate =
    findMeta(html, "article:published_time") ||
    findMeta(html, "datePublished") ||
    findMeta(html, "date") ||
    "";
  const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : "";

  return { title: title, description: description, siteName: siteName, date: date };
}

/* --------------------------------------------------------------------------
   Vetting heuristic — a FIRST PASS only. A human still approves everything.

   Returns { ok, reason }. ok:false means "don't even suggest this one".
   The list is deliberately cautious: anything that reads as negative,
   legal or scandal-shaped is held back so the News tab stays positive.
   -------------------------------------------------------------------------- */
const NEGATIVE = [
  "indict", "arrest", "scandal", "lawsuit", "sued", "sue ", "controvers",
  "resign", "probe", "investigat", "fraud", "corrupt", "allegation", "alleged",
  "backlash", "criticiz", "criticism", "slam", "blast", "ethics complaint",
  "fined", "guilty", "charged with", "felony", "misconduct", "recall", "ouster",
  "step down", "accus", "wrongdoing", "subpoena", "conviction", "convicted",
  "affair", "leak", "resignation", "disgrace", "scrutiny", "outrage",
];

function vetHeadline(title, description, name) {
  const hay = (String(title) + " " + String(description)).toLowerCase();
  const words = String(name || "").toLowerCase().split(/\s+/).filter(Boolean);
  const surname = words[words.length - 1] || "";
  // Require at least the surname. Headlines often say just "Hulsey" or
  // "Rep. Hulsey", so demanding the full name would drop real stories.
  const mentionsName = !surname || hay.indexOf(surname) !== -1;
  if (!mentionsName) return { ok: false, reason: "does not mention " + name };
  for (const term of NEGATIVE) {
    if (hay.indexOf(term) !== -1) return { ok: false, reason: 'contains negative term "' + term.trim() + '"' };
  }
  return { ok: true, reason: "" };
}

/* --------------------------------------------------------------------------
   The "already seen" ledger — data/seen-news.json — so the daily robot
   never suggests the same story twice.
   -------------------------------------------------------------------------- */
const LEDGER = path.join(ROOT, "data", "seen-news.json");

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let s = u.protocol + "//" + u.hostname.replace(/^www\./, "") + u.pathname;
    return s.replace(/\/+$/, "").toLowerCase();
  } catch (e) {
    return String(url || "").trim().toLowerCase();
  }
}

function readLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, "utf8")); }
  catch (e) { return { seen: [] }; }
}
function writeLedger(data) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(data, null, 2) + "\n");
}

// URLs that already have a published post (so we don't re-suggest them).
function publishedSourceUrls() {
  const urls = new Set();
  let files = [];
  try { files = fs.readdirSync(NEWS_SRC); } catch (e) { return urls; }
  files.filter(function (f) { return f.toLowerCase().endsWith(".md"); }).forEach(function (f) {
    const raw = fs.readFileSync(path.join(NEWS_SRC, f), "utf8");
    const m = /^source:\s*(.+)$/im.exec(raw);
    if (m) urls.add(normalizeUrl(m[1].trim().replace(/^["']|["']$/g, "")));
  });
  return urls;
}

/* --------------------------------------------------------------------------
   Writing a post file into content/news/, picking a free filename.
   -------------------------------------------------------------------------- */
function writePost(frontMatter, body) {
  fs.mkdirSync(NEWS_SRC, { recursive: true });
  let slug = frontMatter.slug || slugify(frontMatter.title);
  let file = slug + ".md";
  let n = 2;
  while (fs.existsSync(path.join(NEWS_SRC, file))) {
    file = slug + "-" + n + ".md";
    n++;
  }
  const finalSlug = file.replace(/\.md$/, "");

  const lines = ["---"];
  lines.push("title: " + fmValue(frontMatter.title));
  lines.push("date: " + fmValue(frontMatter.date || today()));
  lines.push("category: " + fmValue(frontMatter.category || "News"));
  lines.push("excerpt: " + fmValue(frontMatter.excerpt));
  if (frontMatter.source) lines.push("source: " + fmValue(frontMatter.source));
  if (frontMatter.draft) lines.push("draft: true");
  lines.push("---");
  lines.push("");
  lines.push(String(body || "").trim());
  lines.push("");

  fs.writeFileSync(path.join(NEWS_SRC, file), lines.join("\n"));
  return { slug: finalSlug, file: "content/news/" + file };
}

/* --------------------------------------------------------------------------
   Write a name=value pair to the step's GITHUB_OUTPUT (single line values).
   -------------------------------------------------------------------------- */
function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  const oneLine = String(value == null ? "" : value).replace(/\r?\n/g, " ");
  if (out) fs.appendFileSync(out, name + "=" + oneLine + "\n");
  else console.log(name + "=" + oneLine);
}

module.exports = {
  ROOT, NEWS_SRC,
  slugify, fmValue, decodeEntities, trimTo, hostname, isoDate, today,
  FORM_LABELS, parseIssueForm, getField, isChecked,
  fetchPage, findMeta, extractMeta,
  vetHeadline,
  normalizeUrl, readLedger, writeLedger, publishedSourceUrls,
  writePost, setOutput,
};
