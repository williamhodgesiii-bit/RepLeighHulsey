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
   Front matter
   ========================================================================== */
function parseFrontMatter(raw) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text.trim() };

  const meta = {};
  match[1].split("\n").forEach(function (line) {
    if (!line.trim() || /^\s*#/.test(line)) return;
    const at = line.indexOf(":");
    if (at === -1) return;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      try { value = JSON.parse(value.replace(/^'|'$/g, '"')); }
      catch (e) { value = value.slice(1, -1); }
    }
    meta[key] = value;
  });
  return { meta: meta, body: match[2].trim() };
}

/* ==========================================================================
   Markdown — the subset a campaign post actually needs
   ========================================================================== */
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text) {
  let out = escapeHTML(text);
  // links: [label](https://example.com)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
    const external = /^https?:\/\//i.test(href);
    return (
      '<a href="' + href + '"' +
      (external ? ' target="_blank" rel="noopener"' : "") +
      ">" + label + "</a>"
    );
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
  return out;
}

function markdownToHTML(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;

  const isBullet = (l) => /^\s*[-*]\s+/.test(l);
  const isNumber = (l) => /^\s*\d+\.\s+/.test(l);

  function collectList(test, strip) {
    const items = [];
    while (i < lines.length && (test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
      if (test(lines[i])) {
        items.push(lines[i].replace(strip, "").trim());
      } else {
        items[items.length - 1] += " " + lines[i].trim();
      }
      i++;
    }
    return items;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^###\s+/.test(line)) { html.push("<h3>" + inlineMarkdown(line.replace(/^###\s+/, "")) + "</h3>"); i++; continue; }
    if (/^##\s+/.test(line))  { html.push("<h2>" + inlineMarkdown(line.replace(/^##\s+/, "")) + "</h2>"); i++; continue; }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
      html.push("<blockquote><p>" + inlineMarkdown(quote.join(" ").trim()) + "</p></blockquote>");
      continue;
    }

    if (isBullet(line)) {
      const items = collectList(isBullet, /^\s*[-*]\s+/);
      html.push("<ul>\n" + items.map((t) => "  <li>" + inlineMarkdown(t) + "</li>").join("\n") + "\n</ul>");
      continue;
    }

    if (isNumber(line)) {
      const items = collectList(isNumber, /^\s*\d+\.\s+/);
      html.push("<ol>\n" + items.map((t) => "  <li>" + inlineMarkdown(t) + "</li>").join("\n") + "\n</ol>");
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>\s?)/.test(lines[i]) &&
           !isBullet(lines[i]) && !isNumber(lines[i])) {
      para.push(lines[i].trim()); i++;
    }
    html.push("<p>" + inlineMarkdown(para.join(" ")) + "</p>");
  }

  return html.join("\n");
}

/* ==========================================================================
   Helpers
   ========================================================================== */
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function longDate(iso) {
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  return MONTHS[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10) + ", " + p[0];
}
function rfc822(iso) {
  const d = new Date(iso + "T12:00:00Z");
  return isNaN(d) ? new Date().toUTCString() : d.toUTCString();
}
function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function attr(s) { return escapeHTML(s).replace(/'/g, "&#39;"); }
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

    const bodyHTML = markdownToHTML(parsed.body);
    return {
      slug: slug,
      title: meta.title || slug,
      date: meta.date || "",
      category: meta.category || "News",
      excerpt: meta.excerpt || "",
      draft: String(meta.draft || "").toLowerCase() === "true",
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
   Page chrome (matches the rest of the site; paths step up one folder)
   ========================================================================== */
const NAV = [
  ["index.html", "Home"],
  ["about.html", "About Leigh"],
  ["issues.html", "On the Issues"],
  ["news.html", "News"],
  ["contact.html", "Contact"],
];
const STAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>';
const rule = (mod) =>
  '<p class="brandrule' + (mod ? " " + mod : "") + '" aria-hidden="true"><i></i>' +
  STAR + STAR + STAR + "<i></i></p>";

function postPage(post, older, newer) {
  const B = "../";
  const canonical = SITE_URL + "/news/" + post.slug + ".html";
  const image = SITE_URL + "/assets/img/logo.png";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    description: post.excerpt,
    articleSection: post.category,
    image: [image],
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: AUTHOR },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: image },
    },
  };

  const nav = (older || newer)
    ? '<div class="article-foot">' +
      (older ? '<a href="' + older.slug + '.html"><small>Previous</small>' + escapeHTML(older.title) + "</a>" : "<span></span>") +
      (newer ? '<a class="next" href="' + newer.slug + '.html"><small>Next</small>' + escapeHTML(newer.title) + "</a>" : "") +
      "</div>"
    : "";

  const share =
    '<div class="share">' +
      "<span>Share</span>" +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(canonical) +
        '" target="_blank" rel="noopener" aria-label="Share on Facebook">' +
        '<svg viewBox="0 0 24 24"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg></a>' +
      '<a href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(canonical) +
        "&text=" + encodeURIComponent(post.title) +
        '" target="_blank" rel="noopener" aria-label="Share on X">' +
        '<svg viewBox="0 0 24 24"><path d="M17.5 3h3l-6.5 7.4L21.7 21h-5.9l-4.6-6-5.3 6H3l7-7.9L2.6 3h6l4.2 5.5L17.5 3z"/></svg></a>' +
      '<a href="mailto:?subject=' + encodeURIComponent(post.title) +
        "&body=" + encodeURIComponent(canonical) + '" aria-label="Share by email">' +
        '<svg viewBox="0 0 24 24"><path d="M3 5h18v14H3V5zm2 2v.5l7 4.5 7-4.5V7H5zm14 10V9.8l-7 4.5-7-4.5V17h14z"/></svg></a>' +
    "</div>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHTML(post.title)} | ${SITE_NAME}</title>
<meta name="description" content="${attr(post.excerpt)}">
<meta name="theme-color" content="#262262">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="${B}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${B}assets/img/logo.png">
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} News" href="${SITE_URL}/feed.xml">
<meta property="og:type" content="article">
<meta property="og:title" content="${attr(post.title)}">
<meta property="og:description" content="${attr(post.excerpt)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="article:published_time" content="${post.date}">
<meta property="article:section" content="${attr(post.category)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(post.title)}">
<meta name="twitter:description" content="${attr(post.excerpt)}">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${B}assets/css/site.css">
<script>document.documentElement.className += " js";</script>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>

<header class="header">
  <div class="wrap header__inner">
    <a class="brand" href="${B}index.html">
      <img src="${B}assets/img/logo.png" alt="${SITE_NAME}" width="1112" height="440">
    </a>
    <nav class="nav" aria-label="Main">
${NAV.map(([href, label]) =>
  '      <a class="nav__link" href="' + B + href + '"' +
  (href === "news.html" ? ' aria-current="page"' : "") + ">" + label + "</a>"
).join("\n")}
    </nav>
    <div class="header__actions">
      <a class="btn btn--sm" href="${B}donate.html">Donate</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="mobile-nav" id="mobile-nav" aria-hidden="true">
  <div class="wrap mobile-nav__inner">
${NAV.map(([href, label]) =>
  '    <a class="mobile-nav__link" href="' + B + href + '"' +
  (href === "news.html" ? ' aria-current="page"' : "") + ">" + label + "</a>"
).join("\n")}
    <a class="btn btn--block" href="${B}donate.html">Donate</a>
  </div>
</div>

<main id="main">
  <article>
    <div class="article-head">
      <div class="wrap-narrow">
        <p class="crumbs"><a href="${B}index.html">Home</a> &rsaquo; <a href="${B}news.html">News</a></p>
        <p class="article-head__meta">${escapeHTML(post.category)}
          <span>&nbsp;|&nbsp; ${longDate(post.date)}</span></p>
        <h1>${escapeHTML(post.title)}</h1>
      </div>
    </div>

    <div class="section">
      <div class="wrap-narrow">
        <div class="article-body">
${post.bodyHTML}
        </div>
        ${share}
        ${nav}
        <p style="margin-top:var(--s-3)"><a href="${B}news.html">&laquo; Back to all news</a></p>
      </div>
    </div>
  </article>
</main>

<div class="mobile-cta">
  <a class="btn" href="${B}donate.html">Donate</a>
  <a class="btn btn--outline" href="${B}contact.html">Volunteer</a>
</div>

<section class="cta">
  <img class="cta__mark" src="${B}assets/img/mark.png" alt="" aria-hidden="true">
  <div class="wrap">
    ${rule("brandrule--center")}
    <h2>Support the Campaign</h2>
    <p>Campaigns in House District 15 are funded by neighbors. A contribution of any size helps us reach voters across the district.</p>
    <div class="btn-row btn-row--center" style="margin-top:1.75rem">
      <a class="btn btn--navy btn--lg" href="${B}donate.html">Donate</a>
      <a class="btn btn--lg btn--outline-white" href="${B}contact.html">Volunteer</a>
    </div>
  </div>
</section>

<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div>
        <div class="footer__logo">
          <img src="${B}assets/img/logo.png" alt="${SITE_NAME}" width="1112" height="440">
        </div>
        <p>
          Leigh Hulsey is a Republican serving House District 15 in the Alabama House of
          Representatives.
        </p>
        <div class="socials">
          <a data-social="facebook" href="#" aria-label="Facebook" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg></a>
          <a data-social="instagram" href="#" aria-label="Instagram" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.9c-.1 3.2-1.6 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.9-.1c-3.3-.2-4.8-1.7-4.9-4.9-.1-1.3-.1-1.6-.1-4.9s0-3.6.1-4.9C2.3 4 3.8 2.4 7.1 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 5a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6zm0 7.9a3.1 3.1 0 110-6.2 3.1 3.1 0 010 6.2zm5-8.1a1.1 1.1 0 11-2.3 0 1.1 1.1 0 012.3 0z"/></svg></a>
          <a data-social="x" href="#" aria-label="X" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M17.5 3h3l-6.5 7.4L21.7 21h-5.9l-4.6-6-5.3 6H3l7-7.9L2.6 3h6l4.2 5.5L17.5 3z"/></svg></a>
        </div>
      </div>
      <div>
        <h4>Campaign</h4>
        <ul>
          <li><a href="${B}about.html">About Leigh</a></li>
          <li><a href="${B}issues.html">On the Issues</a></li>
          <li><a href="${B}news.html">News</a></li>
          <li><a href="${B}contact.html">Contact</a></li>
          <li><a href="${B}donate.html">Donate</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a data-email href="#">info@hulseyforhouse.com</a></li>
          <li><span>Helena, Alabama</span></li>
          <li><span>House District 15</span></li>
        </ul>
      </div>
    </div>
    <div class="footer__legal">
      <span data-disclaimer>Paid for by ${SITE_NAME}.</span>
      <span>&copy; <span data-year>2026</span> ${SITE_NAME}</span>
    </div>
  </div>
</footer>

<script src="${B}assets/js/posts.js"></script>
<script src="${B}assets/js/site.js"></script>
</body>
</html>
`;
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
  fs.writeFileSync(path.join(OUT_DIR, post.slug + ".html"), postPage(post, older, newer));
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
    text: ${jsString(p.plain)},
  },`).join("\n")}
];
`;
fs.writeFileSync(path.join(ROOT, "assets", "js", "posts.js"), postsJs);

// RSS feed
const feed =
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
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
      <description>${escapeHTML(p.excerpt)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
fs.writeFileSync(path.join(ROOT, "feed.xml"), feed);

// Sitemap covering the fixed pages plus every post.
const fixed = ["", "about.html", "issues.html", "news.html", "donate.html", "contact.html"];
const sitemap =
`<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by build-news.js. Change SITE_URL in that file if the domain changes. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fixed.map((f) => `  <url><loc>${SITE_URL}/${f}</loc></url>`).join("\n")}
${posts.map((p) => `  <url><loc>${SITE_URL}/${p.url}</loc><lastmod>${p.date}</lastmod></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log("\nBuilt " + posts.length + " post" + (posts.length === 1 ? "" : "s") + ":");
posts.forEach((p) => console.log("  " + p.date + "  news/" + p.slug + ".html  (" + p.category + ")"));
console.log("\nAlso wrote assets/js/posts.js, feed.xml and sitemap.xml.\n");
