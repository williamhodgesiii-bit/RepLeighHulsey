#!/usr/bin/env node
/* ==========================================================================
   scripts/stamp-assets.js

   Adds a content hash to the stylesheet and script links in every page:

       assets/css/site.css  ->  assets/css/site.css?v=8f2a1c

   Without it the browser keeps its cached copy of site.css, and a design fix
   simply does not appear for anyone who has visited before — the HTML changes,
   the styling does not. The hash changes only when the file's contents change,
   so returning visitors get the new file the moment there is one and keep the
   cached copy the rest of the time.

   Run by `npm run build`.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");

// Every asset that pages link to, and the files to rewrite.
const ASSETS = ["assets/css/site.css", "assets/js/site.js", "assets/js/posts.js"];

function hash(rel) {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex").slice(0, 8);
  } catch (e) {
    return null;
  }
}

function pagesIn(dir) {
  let out = [];
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(function (e) {
    if (e.isFile() && e.name.endsWith(".html")) out.push(path.join(dir, e.name));
  });
  return out;
}

const versions = {};
ASSETS.forEach(function (a) { versions[a] = hash(a); });

const files = pagesIn(".").concat(fs.existsSync(path.join(ROOT, "news")) ? pagesIn("news") : []);
files.push("build-news.js"); // so generated pages carry the stamp too

let changed = 0;
files.forEach(function (rel) {
  const full = path.join(ROOT, rel);
  let text = fs.readFileSync(full, "utf8");
  const before = text;

  ASSETS.forEach(function (asset) {
    const v = versions[asset];
    if (!v) return;
    // Matches href="assets/css/site.css", src="../assets/js/site.js",
    // and the ${B} prefix used inside the page template in build-news.js,
    // with or without an existing ?v= stamp.
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp('((?:href|src)=")((?:\\.\\./|\\$\\{B\\})?)' + escaped + '(?:\\?v=[a-f0-9]+)?(")', "g");
    text = text.replace(re, '$1$2' + asset + "?v=" + v + '$3');
  });

  if (text !== before) {
    fs.writeFileSync(full, text);
    changed++;
  }
});

console.log(
  "Stamped " + changed + " file" + (changed === 1 ? "" : "s") + ": " +
  ASSETS.filter(function (a) { return versions[a]; })
        .map(function (a) { return path.basename(a) + "@" + versions[a]; }).join(", ")
);
