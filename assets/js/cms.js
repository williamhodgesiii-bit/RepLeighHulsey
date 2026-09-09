/* ==========================================================================
   assets/js/cms.js — makes the hand-written pages editable.

   The idea in one paragraph: the pages stay exactly as they are. An element
   whose content the campaign should be able to change gets one attribute —
   data-cms="home.hero.headline" — and that is the whole of it. This file can
   then find those elements, read what is in them, and write new content back.
   Nothing else in the page is touched, so nothing else can break.

   Because a value is stored as the exact text that was already in the page,
   reading a page and writing it straight back returns the identical file, byte
   for byte. scripts/build-pages.js asserts that on every build. Only a field
   somebody actually edits ever changes.

   Attributes it understands:

     data-cms="path"            the element's content is editable
     data-cms-type="..."        text (default), rich, html, or url
     data-cms-label="..."       what the editor calls this field
     data-cms-help="..."        a line of guidance under the field
     data-cms-attr="href:path"  an attribute is editable; comma-separated
     data-cms-list="path"       the children are a repeatable list
     data-cms-item              marks one repeating child
     data-cms-group="..."       groups fields under a heading in the editor

   Runs unchanged in Node (require) and in the browser (window.CMS).
   ========================================================================== */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./markdown.js"));
  else root.CMS = factory(root.MD);
})(typeof self !== "undefined" ? self : this, function (MD) {
  "use strict";

  const VOID = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
    link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1,
  };

  /* ========================================================================
     Walking the HTML

     A small scanner rather than a parser. It only needs to know where tags
     start and end, which quoted attribute values and comments can otherwise
     confuse, and to keep out of <script> and <style>.
     ======================================================================== */

  // Index just past the ">" of the tag opening at `at`.
  function tagEnd(html, at) {
    let i = at + 1;
    while (i < html.length) {
      const c = html[i];
      if (c === '"' || c === "'") {
        const close = html.indexOf(c, i + 1);
        i = close === -1 ? html.length : close + 1;
        continue;
      }
      if (c === ">") return i + 1;
      i++;
    }
    return html.length;
  }

  function tagNameAt(html, at) {
    const m = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(at, at + 48));
    return m ? m[1].toLowerCase() : null;
  }

  // Calls back for every opening tag, in document order.
  function eachTag(html, cb) {
    let i = 0;
    while (i < html.length) {
      const lt = html.indexOf("<", i);
      if (lt === -1) return;
      if (html.startsWith("<!--", lt)) {
        const close = html.indexOf("-->", lt);
        i = close === -1 ? html.length : close + 3;
        continue;
      }
      if (html.startsWith("<!", lt) || html.startsWith("</", lt)) {
        i = tagEnd(html, lt);
        continue;
      }
      const name = tagNameAt(html, lt);
      if (!name) { i = lt + 1; continue; }
      const open = tagEnd(html, lt);
      cb(name, lt, open);
      if (name === "script" || name === "style") {
        const close = html.toLowerCase().indexOf("</" + name, open);
        i = close === -1 ? open : close;
      } else {
        i = open;
      }
    }
  }

  // Where an element's content begins and ends, and where the element itself ends.
  function bounds(html, at) {
    const name = tagNameAt(html, at);
    const open = tagEnd(html, at);
    if (VOID[name] || html[open - 2] === "/") {
      return { name: name, openStart: at, innerStart: open, innerEnd: open, outerEnd: open };
    }
    let depth = 1;
    let i = open;
    while (i < html.length && depth > 0) {
      const lt = html.indexOf("<", i);
      if (lt === -1) break;
      if (html.startsWith("<!--", lt)) {
        const c = html.indexOf("-->", lt);
        i = c === -1 ? html.length : c + 3;
        continue;
      }
      const closing = html.startsWith("</", lt);
      const found = tagNameAt(html, lt);
      const end = tagEnd(html, lt);
      if (found === name) {
        if (closing) {
          depth--;
          if (depth === 0) {
            return { name: name, openStart: at, innerStart: open, innerEnd: lt, outerEnd: end };
          }
        } else if (!VOID[found] && html[end - 2] !== "/") {
          depth++;
        }
      }
      if (found === "script" || found === "style") {
        if (!closing) {
          const c = html.toLowerCase().indexOf("</" + found, end);
          i = c === -1 ? end : c;
          continue;
        }
      }
      i = end;
    }
    return { name: name, openStart: at, innerStart: open, innerEnd: open, outerEnd: open };
  }

  // The attributes of the tag opening at `at`, with where each value sits.
  // Attributes with no value at all (data-cms-item) count too, which is why
  // this cannot be a single "name=value" match.
  function attrs(html, at) {
    const open = tagEnd(html, at);
    const source = html.slice(at, open);
    const skip = (tagNameAt(html, at) || "").length + 1;   // past "<tagname"
    const out = {};
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`=]+)))?/g;
    re.lastIndex = skip;
    let m;
    while ((m = re.exec(source))) {
      const name = m[1].toLowerCase();
      if (m[2] === undefined) {
        out[name] = { value: "", start: at + m.index + m[0].length, end: at + m.index + m[0].length, bare: true };
        continue;
      }
      const raw = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
      const valueAt = at + m.index + m[0].length - raw.length - (m[5] !== undefined ? 0 : 1);
      out[name] = { value: raw, start: valueAt, end: valueAt + raw.length };
    }
    return out;
  }

  /* ========================================================================
     Finding the editable parts of a page
     ======================================================================== */
  function fieldsIn(html) {
    const lists = [];
    const items = [];
    const found = [];

    // First pass: where the repeatable regions are.
    eachTag(html, function (name, at) {
      const a = attrs(html, at);
      if (a["data-cms-list"]) {
        const b = bounds(html, at);
        lists.push({
          kind: "list",
          at: at,
          path: a["data-cms-list"].value,
          label: a["data-cms-label"] ? a["data-cms-label"].value : null,
          help: a["data-cms-help"] ? a["data-cms-help"].value : null,
          group: a["data-cms-group"] ? a["data-cms-group"].value : null,
          itemLabel: a["data-cms-item-label"] ? a["data-cms-item-label"].value : "Item",
          min: a["data-cms-min"] ? parseInt(a["data-cms-min"].value, 10) : 0,
          max: a["data-cms-max"] ? parseInt(a["data-cms-max"].value, 10) : 24,
          innerStart: b.innerStart,
          innerEnd: b.innerEnd,
          items: [],
          itemFields: [],
        });
      }
      if (a["data-cms-item"]) {
        const b = bounds(html, at);
        items.push({ start: at, end: b.outerEnd, list: null });
      }
    });

    // An item belongs to the innermost list that contains it, and an item
    // sitting inside another item is part of that item, not a sibling.
    items.forEach(function (it) {
      if (items.some((o) => o !== it && it.start > o.start && it.end <= o.end)) return;
      const owner = lists
        .filter((l) => it.start >= l.innerStart && it.end <= l.innerEnd)
        .sort((a, b) => b.innerStart - a.innerStart)[0];
      if (owner) { it.list = owner; owner.items.push(it); }
    });
    lists.forEach((l) => l.items.sort((a, b) => a.start - b.start));

    // Second pass: the fields themselves.
    eachTag(html, function (name, at) {
      const a = attrs(html, at);
      if (!a["data-cms"] && !a["data-cms-attr"]) return;
      const b = bounds(html, at);

      const field = {
        kind: "inner",
        at: at,
        path: a["data-cms"] ? a["data-cms"].value : null,
        type: a["data-cms-type"] ? a["data-cms-type"].value : "text",
        label: a["data-cms-label"] ? a["data-cms-label"].value : null,
        help: a["data-cms-help"] ? a["data-cms-help"].value : null,
        group: a["data-cms-group"] ? a["data-cms-group"].value : null,
        tag: name,
        innerStart: b.innerStart,
        innerEnd: b.innerEnd,
        attrs: [],
      };

      if (a["data-cms-attr"]) {
        a["data-cms-attr"].value.split(",").forEach(function (pair) {
          const bits = pair.trim().split(":");
          const attrName = bits[0].trim().toLowerCase();
          const attrPath = (bits[1] || "").trim();
          if (!attrName || !attrPath || !a[attrName]) return;
          field.attrs.push({
            name: attrName,
            path: attrPath,
            start: a[attrName].start,
            end: a[attrName].end,
            value: a[attrName].value,
          });
        });
      }
      if (!field.path && !field.attrs.length) return;

      // Inside a repeating item it is one of that item's fields; anywhere
      // else — including the fixed heading above a list — it belongs to the
      // page itself.
      const holder = items
        .filter((it) => it.list && at >= it.start && b.outerEnd <= it.end)
        .sort((x, y) => y.start - x.start)[0];

      if (holder) holder.list.itemFields.push(field);
      else found.push(field);
    });

    return found.concat(lists).sort((a, b) => a.at - b.at);
  }

  /* ========================================================================
     Reading a page
     ======================================================================== */
  function fieldValue(html, field) {
    const out = {};
    if (field.kind === "inner" && field.path) out[field.path] = html.slice(field.innerStart, field.innerEnd);
    field.attrs.forEach(function (a) { out[a.path] = a.value; });
    return out;
  }

  function itemValues(html, list, item) {
    const value = {};
    list.itemFields
      .filter((f) => f.innerStart >= item.start && f.innerEnd <= item.end)
      .forEach(function (f) {
        Object.assign(value, fieldValue(html, f));
      });
    return value;
  }

  function read(html) {
    const values = {};
    fieldsIn(html).forEach(function (field) {
      if (field.kind === "list") {
        values[field.path] = field.items.map((item) => itemValues(html, field, item));
      } else {
        Object.assign(values, fieldValue(html, field));
      }
    });
    return values;
  }

  /* ========================================================================
     Writing a page

     Every edit is a replacement of one slice of the file. They are collected
     first and applied last to first, so no edit moves another one.
     ======================================================================== */
  function applyEdits(html, edits) {
    edits.sort((a, b) => b.start - a.start);
    let out = html;
    edits.forEach(function (e) {
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
    });
    return out;
  }

  function has(values, path) {
    return Object.prototype.hasOwnProperty.call(values, path) && values[path] != null;
  }

  function write(html, values) {
    const all = fieldsIn(html);
    const lists = all.filter((f) => f.kind === "list");

    // Every ordinary field edit, as a slice of the original file.
    const edits = [];
    all.filter((f) => f.kind !== "list").forEach(function (field) {
      if (field.path && has(values, field.path)) {
        edits.push({ start: field.innerStart, end: field.innerEnd, text: String(values[field.path]) });
      }
      field.attrs.forEach(function (a) {
        if (!has(values, a.path)) return;
        edits.push({ start: a.start, end: a.end, text: escapeAttr(String(values[a.path])) });
      });
    });

    // A list replaces its whole inside, so any field edit landing in there has
    // to be carried out by the list rather than applied over the top of it.
    const inside = function (e, list) { return e.start >= list.innerStart && e.end <= list.innerEnd; };
    const outer = edits.filter((e) => !lists.some((l) => inside(e, l)));

    lists.forEach(function (list) {
      if (!has(values, list.path)) {
        // The list itself is unchanged, but a heading beside it may not be.
        return;
      }
      const mine = edits.filter((e) => inside(e, list));
      outer.push({
        start: list.innerStart,
        end: list.innerEnd,
        text: renderList(html, list, values[list.path], mine),
      });
    });

    // A list whose own value was not supplied still needs its neighbours edited.
    lists.filter((l) => !has(values, l.path)).forEach(function (list) {
      edits.filter((e) => inside(e, list)).forEach((e) => outer.push(e));
    });

    return applyEdits(html, outer);
  }

  // The list's first item is the shape every item takes. Rendering N items
  // means stamping that shape N times, keeping the spacing the page already
  // had between them — and carrying any fixed content above or below along
  // with whatever edits it was due.
  function renderList(html, list, items, neighbourEdits) {
    const inner = html.slice(list.innerStart, list.innerEnd);
    if (!list.items.length) return inner;

    const first = list.items[0];
    const last = list.items[list.items.length - 1];
    const shift = function (from, to) {
      return (neighbourEdits || [])
        .filter((e) => e.start >= from && e.end <= to)
        .map((e) => ({ start: e.start - from, end: e.end - from, text: e.text }));
    };

    const lead = applyEdits(html.slice(list.innerStart, first.start), shift(list.innerStart, first.start));
    const tail = applyEdits(html.slice(last.end, list.innerEnd), shift(last.end, list.innerEnd));
    const gap = list.items.length > 1
      ? html.slice(first.end, list.items[1].start)
      : (lead.match(/\n[ \t]*$/) || ["\n      "])[0];

    const shape = html.slice(first.start, first.end);
    const shapeFields = list.itemFields
      .filter((f) => f.innerStart >= first.start && f.innerEnd <= first.end)
      .map(function (f) {
        return Object.assign({}, f, {
          innerStart: f.innerStart - first.start,
          innerEnd: f.innerEnd - first.start,
          attrs: f.attrs.map((a) => Object.assign({}, a, {
            start: a.start - first.start,
            end: a.end - first.start,
          })),
        });
      });

    const rendered = (items || []).map(function (item) {
      const itemEdits = [];
      shapeFields.forEach(function (f) {
        if (f.path && has(item, f.path)) {
          itemEdits.push({ start: f.innerStart, end: f.innerEnd, text: String(item[f.path]) });
        }
        f.attrs.forEach(function (a) {
          if (!has(item, a.path)) return;
          itemEdits.push({ start: a.start, end: a.end, text: escapeAttr(String(item[a.path])) });
        });
      });
      return applyEdits(shape, itemEdits);
    });

    return lead + rendered.join(gap) + tail;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  /* ========================================================================
     The navigation

     The menu is the one thing that is the same on every page and different on
     each — the current page's link is marked, and the others are not. It is
     rebuilt rather than pattern-matched, so adding a menu item adds it
     everywhere at once.
     ======================================================================== */
  const NAV_KINDS = [
    { cls: "nav__link", indent: "      " },
    { cls: "mobile-nav__link", indent: "    " },
  ];

  function navRead(html) {
    const items = [];
    const re = /<a class="nav__link" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) items.push({ href: m[1], label: htmlToText(m[2]) });
    return items;
  }

  function navWrite(html, items, currentFile) {
    let out = html;
    NAV_KINDS.forEach(function (kind) {
      const re = new RegExp('<a class="' + kind.cls + '" href="[^"]*"[^>]*>[\\s\\S]*?<\\/a>', "g");
      const hits = [];
      let m;
      while ((m = re.exec(out))) hits.push({ start: m.index, end: m.index + m[0].length });
      if (!hits.length) return;

      const rendered = (items || []).map(function (item) {
        const current = item.href === currentFile ? ' aria-current="page"' : "";
        return '<a class="' + kind.cls + '" href="' + escapeAttr(item.href) + '"' + current + ">" +
          escapeText(item.label) + "</a>";
      }).join("\n" + kind.indent);

      out = out.slice(0, hits[0].start) + rendered + out.slice(hits[hits.length - 1].end);
    });
    return out;
  }

  /* ========================================================================
     The shape of the form the editor draws

     Derived from the page itself, so annotating an element is the only step
     needed to make it editable — there is no second list to keep in sync.
     ======================================================================== */
  function schema(html) {
    const out = [];
    fieldsIn(html).forEach(function (field) {
      if (field.kind !== "list") {
        // One element can expose several fields — an image is a picture and a
        // description — so this flattens rather than taking the first.
        describeMany([field]).forEach((f) => out.push(f));
        return;
      }
      out.push((function () {
        return {
          kind: "list",
          path: field.path,
          label: field.label || prettyName(field.path),
          help: field.help,
          group: field.group,
          itemLabel: field.itemLabel,
          min: field.min,
          max: field.max,
          count: field.items.length,
          fields: describeMany(field.itemFields.filter(function (f) {
            const first = field.items[0];
            return first && f.innerStart >= first.start && f.innerEnd <= first.end;
          })),
        };
      })());
    });
    return out;
  }

  function describeMany(fields) {
    const out = [];
    fields.forEach(function (f) {
      if (f.kind === "inner" && f.path) {
        out.push({
          kind: "field",
          path: f.path,
          type: f.type,
          tag: f.tag,
          label: f.label || prettyName(f.path),
          help: f.help,
          group: f.group,
        });
      }
      f.attrs.forEach(function (a) {
        out.push({
          kind: "field",
          path: a.path,
          type: a.name === "href" || a.name === "src" ? "url" : "text",
          attr: a.name,
          tag: f.tag,
          label: attrLabel(f.label, a.name, a.path),
          help: f.help,
          group: f.group,
        });
      });
    });
    return out;
  }

  function prettyName(path) {
    const last = String(path).split(".").pop();
    return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  }
  // "Background photo" and "Background photo description" — not "Background
  // photo image", which is what a blunt label + attribute name would give.
  function attrLabel(label, attr, path) {
    const base = label || prettyName(path);
    if (attr === "src" || attr === "content") return base;
    if (attr === "alt") return base + " description";
    if (attr === "href") return label ? base + " link" : prettyName(path);
    return base + " " + attr;
  }

  /* ========================================================================
     Turning the page's own HTML into something worth typing into, and back

     Only the handful of tags this site's copy actually uses. Anything else is
     left alone as HTML, which the editor then shows as a plain block rather
     than pretending it is simple.
     ======================================================================== */
  const SIMPLE = /^[^<]*$/;

  function isSimple(htmlFragment) {
    return SIMPLE.test(String(htmlFragment));
  }

  function htmlToText(fragment) {
    return decode(String(fragment).replace(/\s+/g, " ").trim());
  }

  function htmlToMarkdown(fragment) {
    let s = String(fragment);
    s = s.replace(/\s*\n\s*/g, " ");
    s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => "\n\n## " + inline(t) + "\n\n");
    s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => "\n\n### " + inline(t) + "\n\n");
    s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, function (_, t) {
      return "\n\n" + inline(t.replace(/<\/?p[^>]*>/gi, " ")).trim().replace(/^/gm, "> ") + "\n\n";
    });
    s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => "\n- " + inline(t).trim());
    s = s.replace(/<\/?(ul|ol)[^>]*>/gi, "\n\n");
    s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => "\n\n" + inline(t).trim() + "\n\n");
    s = inline(s);
    return s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  }

  function inline(s) {
    return decode(String(s)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
      .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]{2,}/g, " "));
  }

  function decode(s) {
    return String(s)
      .replace(/&nbsp;/g, " ")
      .replace(/&middot;/g, "·")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  }

  // Markdown for one line of copy: bold, italics, links and line breaks, but
  // no paragraphs — for a heading or a caption, where a <p> would be wrong.
  function inlineToHTML(text) {
    if (!MD) return escapeText(text);
    return String(text)
      .split("\n")
      .map((line) => MD.inlineMarkdown(line, ""))
      .join("<br>\n");
  }

  /* ------------------------------------------------------------------------
     Between what is in the page and what a person types.

     A value is stored exactly as it appears in the file, so an untouched field
     keeps the file byte for byte. These two turn that into something worth
     typing into, and back again — and only for a field somebody edits.
     ---------------------------------------------------------------------- */
  function toEditable(value, type) {
    const v = value == null ? "" : String(value);
    if (type === "rich") return htmlToMarkdown(v);
    if (type === "inline") return inlineToMarkdown(v);
    if (type === "url") return v;
    return htmlToText(v);
  }

  function fromEditable(text, type) {
    const t = text == null ? "" : String(text);
    if (type === "rich") return "\n" + (MD ? MD.markdownToHTML(t, "") : escapeText(t)) + "\n";
    if (type === "inline") return inlineToHTML(t);
    if (type === "url") return t;
    return escapeText(t.replace(/\s+/g, " ").trim());
  }

  // The inline half of htmlToMarkdown: keeps <br> as a real line break.
  function inlineToMarkdown(fragment) {
    return inline(String(fragment).replace(/\s*\n\s*/g, " ")).replace(/[ \t]+\n/g, "\n").trim();
  }

  function escapeText(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return {
    fieldsIn: fieldsIn,
    read: read,
    write: write,
    schema: schema,
    bounds: bounds,
    attrs: attrs,
    eachTag: eachTag,
    isSimple: isSimple,
    htmlToText: htmlToText,
    htmlToMarkdown: htmlToMarkdown,
    inlineToMarkdown: inlineToMarkdown,
    inlineToHTML: inlineToHTML,
    navRead: navRead,
    navWrite: navWrite,
    toEditable: toEditable,
    fromEditable: fromEditable,
    escapeText: escapeText,
    escapeAttr: escapeAttr,
    markdownToHTML: MD ? MD.markdownToHTML : null,
  };
});
