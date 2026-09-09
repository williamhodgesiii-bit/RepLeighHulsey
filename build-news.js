#!/usr/bin/env node
/* ==========================================================================
   build-news.js — turns the Markdown files in content/news/ into the site's
   news section.

   Run it with:  npm run build      (or:  node build-news.js)

   It writes three things:
     news/<slug>.html   a real page for each post, with its own title, social
                        preview and search-engine listing
     assets/js/posts.js the index used by the news page and the home page
     feed.xml           an RSS feed

   Nothing here needs to run on the web server. The generated files are plain
   HTML and are committed to the repository, so the site stays a static site.
   ========================================================================== */

const fs = require("fs");
const path = require("path");

/* ---- Settings ------------------------------------------------------------
   If the campaign launches on a domain other than the one below, change it
   here. It is used for social previews and the RSS feed, which both need
   full web addresses.
   ------------------------------------------------------------------------- */
const SITE_URL = "https://hulseyforhouse.com";
const SITE_NAME = "Hulsey for House";
const AUTHOR = "Hulsey for House";

const ROOT = __dirname;
const SRC = path.join(ROOT, "content", "news");
const OUT_DIR = path.join(ROOT, "news");

/* ==========================================================================
   Shared with the website editor

   The Markdown rules and the post page template live in assets/js/, not in
   this file, because admin/ renders the very same two modules for its live
   preview. One copy means the preview cannot drift away from what actually
   publishes.
   ========================================================================== */
const MD = require("./assets/js/markdown.js");
const PostTemplate = require("./assets/js/post-template.js");

const escapeHTML = MD.escapeHTML;
const parseFrontMatter = MD.parseFrontMatter;
const markdownToHTML = MD.markdownToHTML;
const stripTags = MD.stripTags;

/* ==========================================================================
   Helpers
   ========================================================================== */
function rfc822(iso) {
  const d = new Date(iso + "T12:00:00Z");
  return isNaN(d) ? new Date().toUTCString() : d.toUTCString();
}

// Last-modified date of a file in the repository, for the sitemap.
function fileDate(relPath) {
  try { return isoDateOf(fs.statSync(path.join(ROOT, relPath)).mtime); }
  catch (e) { return today(); }
}
function isoDateOf(d) { return new Date(d).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

const IMAGE_MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                     ".webp": "image/webp", ".gif": "image/gif" };
function mimeForImage(rel) {
  return IMAGE_MIME[path.extname(String(rel || "")).toLowerCase()] || "image/jpeg";
}
function imageBytes(rel) {
  try { return fs.statSync(path.join(ROOT, rel)).size; } catch (e) { return 0; }
}
function jsString(s) { return JSON.stringify(String(s)); }

/* ==========================================================================
   Read the posts
   ========================================================================== */
if (!fs.existsSync(SRC)) {
  console.error("No content/news directory found at " + SRC);
  process.exit(1);
}

const problems = [];
const posts = fs.readdirSync(SRC)
  .filter((f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"))
  .map(function (file) {
    const slug = file.replace(/\.md$/i, "");
    const parsed = parseFrontMatter(fs.readFileSync(path.join(SRC, file), "utf8"));
    const meta = parsed.meta;

    if (!meta.title) problems.push(file + ": missing a title");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || "")) problems.push(file + ": date must look like 2026-04-09");
    if (!meta.excerpt) problems.push(file + ": missing an excerpt");
    if (!parsed.body) problems.push(file + ": the post has no text under the --- block");

    const bodyHTML = markdownToHTML(parsed.body, "../");
    return {
      slug: slug,
      title: meta.title || slug,
      date: meta.date || "",
      category: meta.category || "News",
      excerpt: meta.excerpt || "",
      draft: String(meta.draft || "").toLowerCase() === "true",
      image: (meta.image || "").trim(),
      imageAlt: (meta.imageAlt || meta.imagealt || "").trim(),
      updated: /^\d{4}-\d{2}-\d{2}$/.test(meta.updated || "") ? meta.updated : "",
      bodyHTML: bodyHTML,
      plain: stripTags(bodyHTML),
      url: "news/" + slug + ".html",
    };
  })
  .filter(function (p) {
    if (p.draft) console.log("  skipping draft: " + p.slug);
    return !p.draft;
  })
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

if (problems.length) {
  console.error("\nThese posts need attention before the site can be built:\n");
  problems.forEach((p) => console.error("  - " + p));
  console.error("");
  process.exit(1);
}


/* ==========================================================================
   Write everything
   ========================================================================== */
fs.mkdirSync(OUT_DIR, { recursive: true });

// Remove pages whose Markdown file has been deleted or renamed.
const expected = new Set(posts.map((p) => p.slug + ".html"));
fs.readdirSync(OUT_DIR)
  .filter((f) => f.endsWith(".html") && !expected.has(f))
  .forEach(function (f) {
    fs.unlinkSync(path.join(OUT_DIR, f));
    console.log("  removed news/" + f + " (no matching Markdown file)");
  });

posts.forEach(function (post, i) {
  const older = posts[i + 1];
  const newer = posts[i - 1];
  fs.writeFileSync(
    path.join(OUT_DIR, post.slug + ".html"),
    PostTemplate.render(post, {
      older: older,
      newer: newer,
      siteUrl: SITE_URL,
      siteName: SITE_NAME,
    })
  );
});

// Index consumed by news.html and the home page.
const postsJs =
`/* ==========================================================================
   GENERATED FILE — do not edit by hand.

   This is written by build-news.js from the Markdown files in content/news/.
   To add or change a post, edit those files and run:  npm run build
   ========================================================================== */

window.POSTS = [
${posts.map((p) => `  {
    slug: ${jsString(p.slug)},
    url: ${jsString(p.url)},
    title: ${jsString(p.title)},
    date: ${jsString(p.date)},
    category: ${jsString(p.category)},
    excerpt: ${jsString(p.excerpt)},
    image: ${jsString(p.image)},
    imageAlt: ${jsString(p.imageAlt || p.title)},
    text: ${jsString(p.plain)},
  },`).join("\n")}
];
`;
fs.writeFileSync(path.join(ROOT, "assets", "js", "posts.js"), postsJs);

// RSS feed
const feed =
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeHTML(SITE_NAME)} — News</title>
    <link>${SITE_URL}/news.html</link>
    <description>Updates from Rep. Leigh Hulsey and the ${escapeHTML(SITE_NAME)} campaign.</description>
    <language>en-us</language>
    <lastBuildDate>${posts.length ? rfc822(posts[0].date) : new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map((p) => `    <item>
      <title>${escapeHTML(p.title)}</title>
      <link>${SITE_URL}/${p.url}</link>
      <guid isPermaLink="true">${SITE_URL}/${p.url}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <category>${escapeHTML(p.category)}</category>
      <description>${escapeHTML(p.excerpt)}</description>${p.image ? `
      <enclosure url="${SITE_URL}/${p.image}" type="${mimeForImage(p.image)}" length="${imageBytes(p.image)}"/>` : ""}
      <content:encoded><![CDATA[${p.image ? `<p><img src="${SITE_URL}/${p.image}" alt="${escapeHTML(p.imageAlt || p.title)}"></p>` : ""}${p.bodyHTML}]]></content:encoded>
    </item>`).join("\n")}
  </channel>
</rss>
`;
fs.writeFileSync(path.join(ROOT, "feed.xml"), feed);

// Sitemap covering the fixed pages plus every post.
// The news index changes whenever a post does; the rest change when edited,
// so they are dated from the file on disk.
const newest = posts.length ? posts[0].date : today();
const fixed = [
  ["", "index.html", "1.0", "weekly"],
  ["about.html", "about.html", "0.8", "monthly"],
  ["issues.html", "issues.html", "0.8", "monthly"],
  ["news.html", "news.html", "0.9", "weekly"],
  ["donate.html", "donate.html", "0.7", "monthly"],
  ["contact.html", "contact.html", "0.7", "monthly"],
];
const sitemap =
`<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by build-news.js. Change SITE_URL in that file if the domain changes. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fixed.map(([loc, file, priority, freq]) => `  <url><loc>${SITE_URL}/${loc}</loc><lastmod>${loc === "news.html" || loc === "" ? newest : fileDate(file)}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`).join("\n")}
${posts.map((p) => `  <url><loc>${SITE_URL}/${p.url}</loc><lastmod>${p.updated || p.date}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log("\nBuilt " + posts.length + " post" + (posts.length === 1 ? "" : "s") + ":");
posts.forEach((p) => console.log("  " + p.date + "  news/" + p.slug + ".html  (" + p.category + ")"));
console.log("\nAlso wrote assets/js/posts.js, feed.xml and sitemap.xml.\n");
