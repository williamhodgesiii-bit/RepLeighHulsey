#!/usr/bin/env node
/* ==========================================================================
   scripts/cms-check.js

   The website editor edits the pages themselves: an element carrying a
   data-cms attribute is a field, and saving rewrites that element's content
   in place. Nothing else in the file is touched.

   That only stays true while reading a page and writing it straight back
   returns the identical file. This checks exactly that, on every page, on
   every build. If an annotation is put somewhere the scanner cannot match —
   a list whose items are not the same shape as each other, say — the build
   stops here rather than the editor quietly mangling a page later.

   Run by `npm run build`.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const CMS = require("../assets/js/cms.js");

const ROOT = path.join(__dirname, "..");

const pages = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .concat(fs.existsSync(path.join(ROOT, "news"))
    ? fs.readdirSync(path.join(ROOT, "news")).filter((f) => f.endsWith(".html")).map((f) => "news/" + f)
    : []);

let fields = 0;
let lists = 0;
const broken = [];

pages.forEach(function (rel) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  let values;
  try {
    values = CMS.read(html);
  } catch (e) {
    broken.push(rel + ": could not be read — " + e.message);
    return;
  }
  if (CMS.write(html, values) !== html) {
    broken.push(rel + ": reading it and writing it straight back does not give the same file");
    return;
  }
  const schema = CMS.schema(html);
  fields += schema.filter((f) => f.kind === "field").length;
  lists += schema.filter((f) => f.kind === "list").length;
});

if (broken.length) {
  console.error("\nThe editor cannot safely edit these pages:\n");
  broken.forEach((b) => console.error("  - " + b));
  console.error("\nUsually one of two things:");
  console.error("  * items in a data-cms-list are not all built the same way");
  console.error("  * a data-cms attribute sits on an element that is never closed\n");
  process.exit(1);
}

console.log("Editor check: " + fields + " editable fields and " + lists +
            " repeatable lists across " + pages.length + " pages. All safe to edit.");
