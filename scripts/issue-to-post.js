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

  if (/delete-post/.test(labels)) return finish(removePost(fields), "deleted");
  if (/edit-post/.test(labels)) return finish(await editPost(fields), "updated");

  const isLink = /news-link/.test(labels) || (!/new-post/.test(labels) && !!link(fields));
  const result = isLink ? await fromLink(fields) : await fromPost(fields);
  if (result.status === "error") return finish(result);

  const written = lib.writePost(result.frontMatter, result.body);
  lib.setOutput("status", "published");
  lib.setOutput("action", "published");
  lib.setOutput("slug", written.slug);
  lib.setOutput("file", written.file);
  lib.setOutput("title", result.frontMatter.title);
  lib.setOutput("url", "news/" + written.slug + ".html");
  console.log("Wrote " + written.file);
}

function finish(result, action) {
  if (result.status === "error") {
    lib.setOutput("status", "error");
    lib.setOutput("message", result.message);
    console.error("Could not continue: " + result.message);
    return;
  }
  lib.setOutput("status", "published");
  lib.setOutput("action", action || "published");
  lib.setOutput("slug", result.slug || "");
  lib.setOutput("title", result.title || "");
  lib.setOutput("url", result.slug ? "news/" + result.slug + ".html" : "");
  console.log(result.log || "Done.");
}

/* ---------- Which post is this about? ------------------------------------- */
function targetSlug(fields) {
  const raw = lib.getField(fields, ["Which post?", "Which post", "Post"]);
  if (!raw) return { error: "No post was named. Paste the post's web address into the form and re-open the issue." };
  const slug = lib.resolveSlug(raw);
  if (!slug) {
    const available = lib.listPosts().slice(0, 12)
      .map(function (p) { return "`" + p.slug + "` — " + p.title; }).join("\n");
    return {
      error: "No post matches \"" + raw + "\". The posts currently on the site are:\n\n" +
             (available || "_none yet_") +
             "\n\nOpen a new issue with one of those addresses.",
    };
  }
  return { slug: slug };
}

/* ---------- Editing a post in place --------------------------------------- */
async function editPost(fields) {
  const target = targetSlug(fields);
  if (target.error) return { status: "error", message: target.error };

  const existing = lib.readPost(target.slug);
  const changes = {};

  const title = lib.getField(fields, ["New headline (leave blank to keep)", "New headline"]);
  const excerpt = lib.getField(fields, ["New one-sentence summary (leave blank to keep)", "New one-sentence summary"]);
  const date = lib.getField(fields, ["New date (YYYY-MM-DD, leave blank to keep)", "New date"]);
  const category = lib.getField(fields, ["New category"]);
  const alt = lib.getField(fields, ["New photo caption (leave blank to keep)"]);
  const newBody = lib.getField(fields, ["New post text (leave blank to keep)", "New post text"]);

  if (title) changes.title = title;
  if (excerpt) changes.excerpt = excerpt;
  if (alt) changes.imageAlt = alt;
  if (category && !/^keep the current/i.test(category)) changes.category = category;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { status: "error", message: 'The date "' + date + '" should look like 2026-09-14 (year-month-day).' };
    }
    changes.date = date;
  }

  const photo = await attachPhoto(fields, ["New photo (leave blank to keep)"], title || existing.meta.title || target.slug);
  if (photo.error) return { status: "error", message: photo.error };
  if (photo.path) changes.image = photo.path;

  // The draft box is a deliberate on/off switch here, not a leave-blank field.
  changes.draft = lib.isChecked(lib.getField(fields, ["Visibility"])) ? true : false;
  changes.updated = lib.today();

  const nothing = !title && !excerpt && !newBody && !date && !alt && !photo.path &&
                  (!category || /^keep the current/i.test(category)) &&
                  changes.draft === (String(existing.meta.draft || "").toLowerCase() === "true");
  if (nothing) {
    return { status: "error", message: "Nothing was filled in, so there was nothing to change. Open a new edit issue and fill in the parts you want to update." };
  }

  const updated = lib.updatePost(target.slug, changes, newBody);
  return {
    status: "ok",
    slug: updated.slug,
    title: updated.title,
    log: "Updated " + updated.file,
  };
}

/* ---------- Removing a post ----------------------------------------------- */
function removePost(fields) {
  const target = targetSlug(fields);
  if (target.error) return { status: "error", message: target.error };

  const gone = lib.deletePost(target.slug);
  if (!gone) return { status: "error", message: "That post could not be removed. It may already be gone." };
  return {
    status: "ok",
    slug: gone.slug,
    title: gone.title,
    log: "Deleted " + gone.file,
  };
}

/* ---------- A photo dragged into the form --------------------------------- */
async function attachPhoto(fields, labels, baseName) {
  const raw = lib.getField(fields, labels);
  if (!raw) return {};
  const url = lib.firstImageUrl(raw);
  if (!url) return { error: "A photo was expected but no image could be found in that box. Drag the image file into the box rather than pasting a screenshot link." };
  try {
    const saved = await lib.saveImage(url, baseName || "news-photo");
    console.log("Saved photo to " + saved);
    return { path: saved };
  } catch (e) {
    return { error: "The photo could not be used: " + e.message + "." };
  }
}

/* ---------- A written blog post -------------------------------------------- */
async function fromPost(fields) {
  const title = lib.getField(fields, ["Headline", "Title", "Headline (title)"]);
  const excerpt = lib.getField(fields, ["One-sentence summary", "Summary", "Excerpt"]);
  const text = lib.getField(fields, ["Post text", "Body", "Post"]);
  let date = lib.getField(fields, ["Date (YYYY-MM-DD)", "Date"]) || lib.today();
  let category = lib.getField(fields, ["Category"]) || "News";
  const other = lib.getField(fields, ["Other category (only if you picked Other)", "Other category"]);
  const draft = lib.isChecked(lib.getField(fields, ["Save as a draft", "Draft?", "Draft", "Save as draft"]));
  const photoAlt = lib.getField(fields, ["What is happening in the photo? (optional)", "Photo caption"]);

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

  const photo = await attachPhoto(fields, ["Photo (optional)", "Photo"], title);
  if (photo.error) return { status: "error", message: photo.error };

  return {
    status: "ok",
    frontMatter: {
      title: title, date: date, category: category, excerpt: excerpt, draft: draft,
      image: photo.path || "", imageAlt: photo.path ? (photoAlt || title) : "",
    },
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
