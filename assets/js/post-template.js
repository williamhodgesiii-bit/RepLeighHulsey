/* ==========================================================================
   assets/js/post-template.js - the HTML of a single news post page.

   Shared, on purpose, by:

     build-news.js   which writes news/<slug>.html for the live site
     admin/          which renders the same function into the editor preview

   Because both call this one function, the preview in the editor is not an
   approximation of the published page. It is the published page, rendered a
   minute early. Change the template here and both move together.

   Runs unchanged in Node (require) and in the browser (window.PostTemplate).
   ========================================================================== */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./markdown.js"));
  else root.PostTemplate = factory(root.MD);
})(typeof self !== "undefined" ? self : this, function (MD) {
  "use strict";

  const escapeHTML = MD.escapeHTML;
  const attr = MD.attr;

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function longDate(iso) {
  const p = String(iso).split("-");
  if (p.length !== 3) return iso;
  return MONTHS[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10) + ", " + p[0];
}

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


  /* ------------------------------------------------------------------------
     render(post, options)

       post      slug, title, date, category, excerpt, image, imageAlt,
                 updated, bodyHTML
       older     the next post back, for the footer link (optional)
       newer     the next post forward (optional)
       siteUrl   e.g. https://hulseyforhouse.com
       siteName  e.g. Hulsey for House
       base      how far up the site root is; "../" from news/ and from admin/
       scripts   false leaves out the page JavaScript, which is how the editor
                 previews it. Post pages do not need JavaScript to read, so a
                 script-free preview still shows exactly what a visitor sees.
     ---------------------------------------------------------------------- */
  function render(post, options) {
    const o = options || {};
    const SITE_URL = o.siteUrl || "https://hulseyforhouse.com";
    const SITE_NAME = o.siteName || "Hulsey for House";
    const B = o.base == null ? "../" : o.base;
    const withScripts = o.scripts !== false;

function postPage(post, older, newer) {
  const canonical = SITE_URL + "/news/" + post.slug + ".html";
  const logo = SITE_URL + "/assets/img/logo.png";
  // A post with its own photograph shares that photograph; everything else
  // falls back to the campaign logo.
  const image = post.image ? SITE_URL + "/" + post.image.replace(/^\/+/, "") : logo;
  const modified = post.updated || post.date;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: post.title,
        datePublished: post.date,
        dateModified: modified,
        description: post.excerpt,
        articleSection: post.category,
        image: [image],
        mainEntityOfPage: canonical,
        url: canonical,
        inLanguage: "en-US",
        isAccessibleForFree: true,
        author: { "@type": "Person", name: "Leigh Hulsey" },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: logo },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
          { "@type": "ListItem", position: 2, name: "News", item: SITE_URL + "/news.html" },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
    ],
  };

  // The photograph leads the article, framed the same way as elsewhere.
  const hero = post.image
    ? '<figure class="article-hero">' +
        '<div class="media media--wide">' +
          '<img src="' + B + escapeHTML(post.image) + '" alt="' + attr(post.imageAlt || post.title) + '" ' +
          'width="1600" height="900" fetchpriority="high" decoding="async">' +
        "</div>" +
        (post.imageAlt ? "<figcaption>" + escapeHTML(post.imageAlt) + "</figcaption>" : "") +
      "</figure>"
    : "";

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
<meta property="article:modified_time" content="${modified}">
<meta property="article:section" content="${attr(post.category)}">
<meta name="author" content="Leigh Hulsey">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(post.title)}">
<meta name="twitter:description" content="${attr(post.excerpt)}">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${B}assets/css/site.css?v=ef5d7dc7">
${withScripts ? '<script>document.documentElement.className += " js";</script>' : ''}
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
        ${hero}
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
  <img class="cta__mark" src="${B}assets/img/mark-outline.svg" alt="" aria-hidden="true">
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

<script src="${B}assets/js/posts.js?v=829ceb0a"></script>
<script src="${B}assets/js/site.js?v=96754abe"></script>
</body>
</html>
`;
}

    return postPage(post, o.older, o.newer);
  }

  return { render: render };
});
