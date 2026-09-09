/* ==========================================================================
   assets/js/markdown.js — the Markdown subset a campaign post actually needs.

   This file is deliberately shared by two places:

     build-news.js   turns the Markdown in content/news/ into the pages that
                     go live.
     admin/          the website editor's live preview.

   They must never disagree. If the editor rendered a post one way and the
   build rendered it another, the preview would be a polite fiction. Keeping
   one copy of the rules is what makes "what you see is what publishes" true
   rather than aspirational.

   Runs unchanged in Node (require) and in the browser (window.MD).
   ========================================================================== */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MD = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // For an attribute value, where a bare apostrophe would end a '-quoted one.
  function attr(s) {
    return escapeHTML(s).replace(/'/g, "&#39;");
  }

  // Post pages live in news/, one folder down from the rest of the site, so a
  // link someone writes as (contact.html) has to become ../contact.html or it
  // resolves to news/contact.html and 404s. Anything absolute is left alone.
  function resolveHref(href, base) {
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return href;
    if (href.startsWith("../") || href.startsWith("./")) return href;
    return (base || "") + href;
  }

  function inlineMarkdown(text, base) {
    var out = escapeHTML(text);
    // links: [label](https://example.com)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
      var external = /^https?:\/\//i.test(href);
      return (
        '<a href="' + resolveHref(href, base) + '"' +
        (external ? ' target="_blank" rel="noopener"' : "") +
        ">" + label + "</a>"
      );
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
    out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
    return out;
  }

  function markdownToHTML(md, base) {
    var lines = String(md == null ? "" : md).replace(/\r\n/g, "\n").split("\n");
    var html = [];
    var i = 0;

    var isBullet = function (l) { return /^\s*[-*]\s+/.test(l); };
    var isNumber = function (l) { return /^\s*\d+\.\s+/.test(l); };

    function collectList(test, strip) {
      var items = [];
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
      var line = lines[i];

      if (!line.trim()) { i++; continue; }

      if (/^###\s+/.test(line)) { html.push("<h3>" + inlineMarkdown(line.replace(/^###\s+/, ""), base) + "</h3>"); i++; continue; }
      if (/^##\s+/.test(line))  { html.push("<h2>" + inlineMarkdown(line.replace(/^##\s+/, ""), base) + "</h2>"); i++; continue; }

      if (/^>\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
        html.push("<blockquote><p>" + inlineMarkdown(quote.join(" ").trim(), base) + "</p></blockquote>");
        continue;
      }

      if (isBullet(line)) {
        var bullets = collectList(isBullet, /^\s*[-*]\s+/);
        html.push("<ul>\n" + bullets.map(function (t) { return "  <li>" + inlineMarkdown(t, base) + "</li>"; }).join("\n") + "\n</ul>");
        continue;
      }

      if (isNumber(line)) {
        var numbers = collectList(isNumber, /^\s*\d+\.\s+/);
        html.push("<ol>\n" + numbers.map(function (t) { return "  <li>" + inlineMarkdown(t, base) + "</li>"; }).join("\n") + "\n</ol>");
        continue;
      }

      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>\s?)/.test(lines[i]) &&
             !isBullet(lines[i]) && !isNumber(lines[i])) {
        para.push(lines[i].trim()); i++;
      }
      html.push("<p>" + inlineMarkdown(para.join("\n"), base).replace(/\n/g, "<br>\n") + "</p>");
    }

    return html.join("\n");
  }

  function stripTags(html) {
    return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  /* ------------------------------------------------------------------------
     Front matter — the "---" block at the top of a post file.
     Shared so the editor reads a post exactly as the build does.
     ---------------------------------------------------------------------- */
  function parseFrontMatter(raw) {
    var text = String(raw == null ? "" : raw).replace(/^﻿/, "").replace(/\r\n/g, "\n");
    var match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: text.trim() };

    var meta = {};
    match[1].split("\n").forEach(function (line) {
      if (!line.trim() || /^\s*#/.test(line)) return;
      var at = line.indexOf(":");
      if (at === -1) return;
      var key = line.slice(0, at).trim();
      var value = line.slice(at + 1).trim();
      if (
        (value.charAt(0) === '"' && value.slice(-1) === '"') ||
        (value.charAt(0) === "'" && value.slice(-1) === "'")
      ) {
        try { value = JSON.parse(value.replace(/^'|'$/g, '"')); }
        catch (e) { value = value.slice(1, -1); }
      }
      meta[key] = value;
    });
    return { meta: meta, body: match[2].trim() };
  }

  // A YAML-safe scalar. Mirrors fmValue in scripts/lib.js so a post written by
  // the editor and one written by an issue form are the same file.
  function fmValue(value) {
    var s = String(value == null ? "" : value).replace(/\r?\n/g, " ").trim();
    if (s === "") return '""';
    if (/^[A-Za-z0-9][A-Za-z0-9 ._/()-]*$/.test(s)) return s;
    return JSON.stringify(s);
  }

  // The whole Markdown file: front matter, then the body.
  function renderPostFile(meta, body) {
    var lines = ["---"];
    lines.push("title: " + fmValue(meta.title));
    lines.push("date: " + fmValue(meta.date));
    lines.push("category: " + fmValue(meta.category || "News"));
    lines.push("excerpt: " + fmValue(meta.excerpt));
    if (meta.image) lines.push("image: " + fmValue(meta.image));
    if (meta.imageAlt) lines.push("imageAlt: " + fmValue(meta.imageAlt));
    if (meta.source) lines.push("source: " + fmValue(meta.source));
    if (meta.updated) lines.push("updated: " + fmValue(meta.updated));
    if (meta.draft) lines.push("draft: true");
    lines.push("---");
    lines.push("");
    lines.push(String(body || "").trim());
    lines.push("");
    return lines.join("\n");
  }

  // Turn "Hulsey: Town Hall in Helena!" into "hulsey-town-hall-in-helena".
  // Mirrors slugify in scripts/lib.js. Always ^[a-z0-9-]+$, so a title can
  // never name a file outside content/news/.
  function slugify(input) {
    var base = String(input || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70)
      .replace(/-+$/g, "");
    if (base) return base;
    return "post-" + new Date().toISOString().slice(0, 10);
  }

  return {
    escapeHTML: escapeHTML,
    attr: attr,
    inlineMarkdown: inlineMarkdown,
    markdownToHTML: markdownToHTML,
    stripTags: stripTags,
    parseFrontMatter: parseFrontMatter,
    fmValue: fmValue,
    renderPostFile: renderPostFile,
    slugify: slugify,
  };
});
