#!/usr/bin/env node
/* ==========================================================================
   scripts/check-issue-forms.js

   GitHub silently hides an issue form it cannot parse — no error, no warning,
   the option just stops appearing in the "New issue" picker. That cost three
   rounds of guessing once already: the culprit was

       placeholder: 2026-09-14

   which YAML reads as a date, not a string, so GitHub's schema rejected the
   whole file. This check catches that class of mistake before it ships.

   Run it with:  npm run check-forms
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", ".github", "ISSUE_TEMPLATE");
// Every one of these must be a plain string in the YAML.
const STRING_KEYS = ["label", "description", "placeholder", "value", "name", "title"];
const TYPES = ["markdown", "input", "textarea", "dropdown", "checkboxes"];

const problems = [];

function fail(file, msg) { problems.push(file + ": " + msg); }

// A deliberately small YAML reader: enough to see the shape of an issue form
// and, crucially, whether a scalar was quoted. No dependency to install.
function scalarLooksUnquoted(raw) {
  const v = raw.trim();
  if (!v || v === "|" || v === ">" || v.startsWith("|") || v.startsWith(">")) return null;
  if (/^["']/.test(v)) return null;                       // quoted: fine
  if (/^\d{4}-\d{2}-\d{2}([ T].*)?$/.test(v)) return "a date";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "a number";
  if (/^(true|false|yes|no|on|off|null|~)$/i.test(v)) return "a boolean or null";
  return null;
}

fs.readdirSync(DIR)
  .filter(function (f) { return /\.ya?ml$/.test(f) && f !== "config.yml"; })
  .forEach(function (f) {
    const text = fs.readFileSync(path.join(DIR, f), "utf8");
    const lines = text.split("\n");

    if (!/^name:/m.test(text)) fail(f, "missing a top-level `name:`");
    if (!/^description:/m.test(text)) fail(f, "missing a top-level `description:`");
    if (!/^body:/m.test(text)) fail(f, "missing a top-level `body:`");

    lines.forEach(function (line, i) {
      const m = /^\s*(-\s+)?([a-zA-Z_]+):\s*(.*)$/.exec(line);
      if (!m) return;
      const key = m[2];
      const value = m[3];

      if (STRING_KEYS.indexOf(key) !== -1) {
        const kind = scalarLooksUnquoted(value);
        if (kind) {
          fail(f, "line " + (i + 1) + ": `" + key + ": " + value.trim() + "` reads as " +
                  kind + ", not text. Wrap it in quotes — GitHub will hide the whole form otherwise.");
        }
      }

      if (key === "type" && TYPES.indexOf(value.trim().replace(/^["']|["']$/g, "")) === -1) {
        fail(f, "line " + (i + 1) + ": unknown field type `" + value.trim() + "`");
      }
    });

    // Every id has to be unique inside its file.
    const ids = (text.match(/^\s*id:\s*(.+)$/gm) || []).map(function (l) { return l.split(":")[1].trim(); });
    ids.forEach(function (id, i) {
      if (ids.indexOf(id) !== i) fail(f, "duplicate id `" + id + "`");
    });
  });

if (problems.length) {
  console.error("\nIssue forms that GitHub would refuse to show:\n");
  problems.forEach(function (p) { console.error("  - " + p); });
  console.error("");
  process.exit(1);
}
console.log("Issue forms look fine.");
