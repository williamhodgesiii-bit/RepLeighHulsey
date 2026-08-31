#!/usr/bin/env node
/* ==========================================================================
   scripts/discover-news.js — the daily news robot.

   Runs on a schedule inside GitHub Actions (.github/workflows/discover-news.yml).

   What it does, in plain terms:
     1. Searches Google News for fresh stories about Rep. Leigh Hulsey.
     2. Throws out anything that reads negative, or that we've seen before.
     3. Opens a "review" issue for each surviving story, pre-filled and ready.

   It never publishes anything on its own. A person still adds the "approved"
   label to publish, or closes the issue to skip it. That human step is the
   real vetting — this script just does the first pass and the typing.
   ========================================================================== */

"use strict";

const { execFileSync } = require("child_process");
const lib = require("./lib");

const NAME = "Leigh Hulsey";
const QUERIES = (process.env.NEWS_QUERIES ||
  '"Leigh Hulsey" Alabama|"Representative Leigh Hulsey"').split("|");
const MAX_NEW = parseInt(process.env.MAX_NEW_PER_RUN || "4", 10);
const REPO = process.env.GITHUB_REPOSITORY || "";

async function main() {
  const ledger = lib.readLedger();
  const seen = new Set((ledger.seen || []).map(lib.normalizeUrl));
  const published = lib.publishedSourceUrls();

  const candidates = [];
  const runSeen = new Set();

  for (const q of QUERIES) {
    let items = [];
    try {
      items = await searchGoogleNews(q.trim());
    } catch (e) {
      console.log('Search failed for "' + q.trim() + '": ' + e.message);
      continue;
    }
    for (const item of items) {
      if (candidates.length >= MAX_NEW) break;

      const vet = lib.vetHeadline(item.headline, item.description, NAME);
      if (!vet.ok) { console.log("  skip (" + vet.reason + "): " + item.headline); continue; }

      const articleUrl = await resolveArticleUrl(item.link);
      const key = lib.normalizeUrl(articleUrl);
      const gkey = lib.normalizeUrl(item.link);
      if (seen.has(key) || seen.has(gkey) || published.has(key) || runSeen.has(key)) {
        console.log("  already seen: " + item.headline);
        continue;
      }
      runSeen.add(key);
      candidates.push({
        headline: item.headline,
        url: articleUrl,
        source: item.source || lib.hostname(articleUrl),
        date: item.date || lib.today(),
      });
    }
    if (candidates.length >= MAX_NEW) break;
  }

  if (!candidates.length) {
    console.log("No new stories to suggest today.");
    return;
  }

  let created = 0;
  for (const c of candidates) {
    try {
      openReviewIssue(c);
      (ledger.seen = ledger.seen || []).push(lib.normalizeUrl(c.url));
      created++;
      console.log("Queued for review: " + c.headline);
    } catch (e) {
      console.log("Could not open a review issue for: " + c.headline + " (" + e.message + ")");
    }
  }

  // Keep the ledger from growing without bound.
  if (ledger.seen.length > 500) ledger.seen = ledger.seen.slice(-500);
  lib.writeLedger(ledger);
  lib.setOutput("created", String(created));
  console.log("\nOpened " + created + " review issue(s).");
}

/* ---------- Google News RSS -------------------------------------------------
   No API key needed. Returns [{ headline, link, source, description, date }].
   -------------------------------------------------------------------------- */
async function searchGoogleNews(query) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=en-US&gl=US&ceid=US:en";
  const page = await lib.fetchPage(url, { timeoutMs: 15000, maxBytes: 2000000 });
  const items = [];
  const blocks = page.html.split(/<item>/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/<\/item>/i)[0];
    const rawTitle = tag(body, "title");
    const link = tag(body, "link");
    const pub = tag(body, "pubDate");
    const desc = lib.decodeEntities(stripTags(tag(body, "description")));
    const sourceName = lib.decodeEntities(tag(body, "source"));
    if (!rawTitle || !link) continue;

    const title = lib.decodeEntities(rawTitle);
    // Google News titles read "Headline - Publisher"; keep just the headline.
    let headline = title;
    if (sourceName && title.endsWith(" - " + sourceName)) {
      headline = title.slice(0, -(" - " + sourceName).length).trim();
    } else {
      headline = title.replace(/\s+-\s+[^-]+$/, "").trim() || title;
    }
    items.push({
      headline: headline,
      link: link.trim(),
      source: sourceName,
      description: desc,
      date: lib.isoDate(pub) || "",
    });
  }
  return items;
}

function tag(xml, name) {
  const m = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i").exec(xml);
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}
function stripTags(s) { return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

// Follow Google's redirect to the real publisher URL where possible.
async function resolveArticleUrl(googleUrl) {
  try {
    const page = await lib.fetchPage(googleUrl, { timeoutMs: 12000 });
    if (page.finalUrl && !/google\./.test(lib.hostname(page.finalUrl))) return page.finalUrl;
    const found = page.html.match(/https?:\/\/[^"'<>\\ ]+/g) || [];
    for (let u of found) {
      const h = lib.hostname(u);
      if (h && !/google\.|gstatic\.|youtube\.|schema\.org/.test(h)) {
        return u.replace(/&amp;/g, "&");
      }
    }
    return page.finalUrl || googleUrl;
  } catch (e) {
    return googleUrl;
  }
}

/* ---------- Open a pre-filled review issue ---------------------------------
   The body matches the "Submit a news link" form exactly, so the same
   publisher (scripts/issue-to-post.js) can read it. Reviewer instructions
   sit ABOVE the first heading, where the form parser ignores them.
   -------------------------------------------------------------------------- */
function openReviewIssue(c) {
  const body = [
    "🤖 **Auto-suggested for the News tab.**",
    "",
    "If this story looks good and puts Rep. Hulsey in a good light, add the **`approved`** label to publish it.",
    "To skip it, just **close** this issue.",
    "",
    "Source: " + (c.source || "unknown") + " · Found " + lib.today(),
    "",
    "### News link (URL)",
    "",
    c.url,
    "",
    "### Headline to show (optional)",
    "",
    c.headline || "_No response_",
    "",
    "### Category",
    "",
    "In the News",
    "",
    "### Why it matters (optional)",
    "",
    "_No response_",
    "",
  ].join("\n");

  const title = "[News link] " + lib.trimTo(c.headline || c.url, 80);
  const args = ["issue", "create", "--title", title, "--body", body,
    "--label", "news-link", "--label", "needs-review"];
  if (REPO) args.push("--repo", REPO);
  execFileSync("gh", args, { stdio: ["ignore", "inherit", "inherit"] });
}

if (require.main === module) {
  main().catch(function (e) {
    console.error(e);
    process.exit(0); // never fail the scheduled run over a transient hiccup
  });
}

module.exports = { searchGoogleNews, resolveArticleUrl, openReviewIssue };
