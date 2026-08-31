#!/usr/bin/env node
/* ==========================================================================
   scripts/issue-to-post.js — turn a submitted issue form into a news post.

   Runs inside GitHub Actions (see .github/workflows/publish-from-issue.yml).
   It reads the issue from environment variables (never from the command line,
   so nothing a submitter types can run as a command), writes ONE Markdown file
   into content/news/, and reports the result back through GITHUB_OUTPUT.

   Two kinds of submission, told apart by the issue's labels:
     new-post    a blog post someone wrote  (Headline, Summary, Post text …)
     news-link   a link to an outside story (URL) that gets auto-formatted
   ========================================================================== */

"use strict";

const lib = require("./lib");

const NAME = "Leigh Hulsey";

async function main() {
  const body = process.env.ISSUE_BODY || "";
  const labels = (process.env.ISSUE_LABELS || "").toLowerCase();
  const fields = lib.parseIssueForm(body);

  const isLink = /news-link/.test(labels) || (!/new-post/.test(labels) && !!link(fields));

  const result = isLink ? await fromLink(fields) : fromPost(fields);

  if (result.status === "error") {
    lib.setOutput("status", "error");
    lib.setOutput("message", result.message);
    console.error("Could not publish: " + result.message);
    return;
  }

  const written = lib.writePost(result.frontMatter, result.body);
  lib.setOutput("status", "published");
  lib.setOutput("slug", written.slug);
  lib.setOutput("file", written.file);
  lib.setOutput("title", result.frontMatter.title);
  lib.setOutput("url", "news/" + written.slug + ".html");
  console.log("Wrote " + written.file);
}

/* ---------- A written blog post -------------------------------------------- */
function fromPost(fields) {
  const title = lib.getField(fields, ["Headline", "Title", "Headline (title)"]);
  const excerpt = lib.getField(fields, ["One-sentence summary", "Summary", "Excerpt"]);
  const text = lib.getField(fields, ["Post text", "Body", "Post"]);
  let date = lib.getField(fields, ["Date (YYYY-MM-DD)", "Date"]) || lib.today();
  let category = lib.getField(fields, ["Category"]) || "News";
  const other = lib.getField(fields, ["Other category (only if you picked Other)", "Other category"]);
  const draft = lib.isChecked(lib.getField(fields, ["Draft?", "Draft", "Save as draft"]));

  if (/^other/i.test(category) && other) category = other;
  if (/^other/i.test(category)) category = "News";

  const missing = [];
  if (!title) missing.push("a Headline");
  if (!excerpt) missing.push("a one-sentence summary");
  if (!text) missing.push("the post text");
  if (missing.length) {
    return { status: "error", message: "The post is missing " + missing.join(", ") + ". Edit the issue to add it, then re-approve." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", message: 'The date "' + date + '" should look like 2026-09-14 (year-month-day). Edit the issue and re-approve.' };
  }

  return {
    status: "ok",
    frontMatter: { title: title, date: date, category: category, excerpt: excerpt, draft: draft },
    body: text,
  };
}

/* ---------- A pasted news link, auto-formatted ----------------------------- */
async function fromLink(fields) {
  const url = link(fields);
  if (!url) {
    return { status: "error", message: "No news link was found in the submission. Add a link (starting with https://) and re-approve." };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { status: "error", message: 'The link "' + url + '" should start with https://' };
  }

  const headline = lib.getField(fields, ["Headline to show (optional)", "Headline", "Headline to show"]);
  const note = lib.getField(fields, ["Why it matters (optional)", "Why it matters", "Note"]);
  let category = lib.getField(fields, ["Category"]) || "In the News";
  if (/^other/i.test(category)) category = "In the News";

  let meta = { title: "", description: "", siteName: lib.hostname(url), date: "" };
  let finalUrl = url;
  try {
    const page = await lib.fetchPage(url);
    finalUrl = page.finalUrl || url;
    meta = lib.extractMeta(page.html, finalUrl);
  } catch (e) {
    console.log("Note: could not read the page (" + e.message + "). Using what was provided.");
  }

  const source = meta.siteName || lib.hostname(finalUrl) || "the source";
  const title = headline || meta.title || source + " story";
  const date = meta.date || lib.today();
  const excerpt =
    lib.trimTo(note, 200) ||
    lib.trimTo(meta.description, 200) ||
    lib.trimTo(title, 200);

  // Build a short, clearly-attributed card that links out to the full story.
  const paras = [];
  if (note) {
    paras.push(note);
  } else {
    paras.push("Rep. " + NAME + " was featured in " + source + ".");
  }
  if (meta.description && meta.description.toLowerCase() !== note.toLowerCase()) {
    paras.push("> " + meta.description);
  }
  paras.push("**Read the full story:** [" + linkText(title, source) + "](" + finalUrl + ")");

  return {
    status: "ok",
    frontMatter: { title: title, date: date, category: category, excerpt: excerpt, source: finalUrl },
    body: paras.join("\n\n"),
  };
}

function link(fields) {
  return lib.getField(fields, ["News link (URL)", "News link", "Link (URL)", "Link", "URL"]);
}

// Markdown link text can't contain unescaped ] — keep it clean.
function linkText(title, source) {
  const t = String(title).replace(/[\[\]]/g, "").trim();
  const s = String(source).replace(/[\[\]]/g, "").trim();
  return s && t.toLowerCase().indexOf(s.toLowerCase()) === -1 ? t + " — " + s : t;
}

main().catch(function (e) {
  lib.setOutput("status", "error");
  lib.setOutput("message", "Something went wrong while publishing: " + e.message);
  console.error(e);
});
