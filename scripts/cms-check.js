#!/usr/bin/env node
/* ==========================================================================
   scripts/cms-check.js

   The website editor edits the pages themselves: an element carrying a
   data-cms attribute is a field, and saving rewrites that element's content
   in place. Nothing else in the file is touched.

   That only stays true while two things hold, and this checks both on every
   page on every build, so the build stops here rather than the editor quietly
   mangling a page later:

     1. Reading a page and writing it straight back returns the identical file.
        An annotation the scanner cannot match — a list whose items are not the
        same shape as each other, say — shows up here.

     2. What the editor puts in a box, and what comes back out of the box next
        time it is opened, are the same words. This is the one that catches an
        annotation whose value does not survive the trip through the form: an
        attribute that gets HTML-escaped twice, a heading marked "rich" that
        gains a paragraph around it every time somebody saves.

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

  roundTripFields(rel, html, values, schema);
});

/* Every field, taken out of the page, put in a box, put back, and taken out
   again. Anything that comes back different would change a page every time
   somebody saved it without touching that field. */
function roundTripFields(rel, html, values, schema) {
  schema.forEach(function (field) {
    if (field.kind === "list") {
      (values[field.path] || []).forEach(function (item, i) {
        field.fields.forEach((f) => checkOne(rel, html, values, f, field, i, item[f.path]));
      });
      return;
    }
    checkOne(rel, html, values, field, null, null, values[field.path]);
  });
}

function checkOne(rel, html, values, field, list, index, value) {
  if (value == null) return;

  // What the editor shows, and what it stores when that is handed back.
  const shown = field.attr ? String(value) : CMS.toEditable(value, field.type);
  const stored = field.attr ? shown : CMS.fromEditable(shown, field.type);

  const next = JSON.parse(JSON.stringify(values));
  if (list) next[list.path][index][field.path] = stored;
  else next[field.path] = stored;

  let back;
  try {
    back = CMS.read(CMS.write(html, next));
  } catch (e) {
    broken.push(rel + ": " + field.path + " could not be written back — " + e.message);
    return;
  }

  const after = list ? (back[list.path][index] || {})[field.path] : back[field.path];
  const shownAgain = field.attr ? String(after == null ? "" : after) : CMS.toEditable(after, field.type);

  if (shownAgain !== shown) {
    broken.push(rel + ": " + field.path + " does not survive being edited — " +
      "the editor shows " + JSON.stringify(trim(shown)) + " and gets back " +
      JSON.stringify(trim(shownAgain)));
  }
}

function trim(s) {
  const text = String(s);
  return text.length > 70 ? text.slice(0, 70) + "…" : text;
}

if (broken.length) {
  console.error("\nThe editor cannot safely edit these pages:\n");
  broken.forEach((b) => console.error("  - " + b));
  console.error("\nUsually one of these:");
  console.error("  * items in a data-cms-list are not all built the same way");
  console.error("  * a data-cms attribute sits on an element that is never closed");
  console.error("  * data-cms-type says rich or inline where the markup is not\n");
  process.exit(1);
}

console.log("Editor check: " + fields + " editable fields and " + lists +
            " repeatable lists across " + pages.length + " pages. All safe to edit.");
