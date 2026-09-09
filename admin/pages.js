/* ==========================================================================
   admin/pages.js — the rest of the website: pages, photos and settings.

   The news editor in admin.js writes Markdown files. This writes the pages
   themselves. An element in a page carrying data-cms is a field; saving
   rewrites that element's content and leaves the entire rest of the file
   alone. assets/js/cms.js does the reading and writing, and
   scripts/cms-check.js proves on every build that it is safe to.

   The preview is the page. Not a rendering of it — the actual file with the
   edits applied, which is what will be committed. Clicking anything in it
   jumps to the field that controls it.
   ========================================================================== */

(function () {
  "use strict";

  const E = window.Editor;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = E.esc;

  const PAGES = [
    { file: "index.html", name: "Home", note: "The front page" },
    { file: "about.html", name: "About Leigh", note: "Biography and quick facts" },
    { file: "issues.html", name: "On the Issues", note: "Where Leigh stands" },
    { file: "contact.html", name: "Contact", note: "Volunteer form and office details" },
    { file: "donate.html", name: "Donate", note: "Contribution page" },
  ];

  // Every page that carries the menu. Changing the menu changes all of them.
  const NAV_PAGES = ["index.html", "about.html", "issues.html", "contact.html",
                     "donate.html", "news.html", "submit-news.html", "404.html", "news-post.html"];

  const IMG_DIRS = ["assets/img", "assets/img/news"];
  const LINK_CHOICES = ["index.html", "about.html", "issues.html", "news.html",
                        "contact.html", "donate.html"];

  const s = {
    page: null,        // {file, name, html, values, schema}
    dirty: false,
    media: null,
    pickingFor: null,  // the image field waiting for a photo
    settings: null,
  };

  /* ========================================================================
     Reading and writing files in the repository
     ======================================================================== */
  function fileUrl(path) {
    return "/repos/" + E.repo() + "/contents/" + path + "?ref=" + encodeURIComponent(E.config.branch);
  }
  const readFile = (path) => E.ghRaw(fileUrl(path));

  /* ========================================================================
     Pages: the list
     ======================================================================== */
  function renderPages() {
    $("#pages-body").innerHTML = E.signedOutNotice() + '<div class="cards">' + PAGES.map(function (p) {
      return (
        '<button class="card" type="button" data-page="' + esc(p.file) + '">' +
          '<span class="card__icon">' + pageIcon(p.file) + "</span>" +
          "<span>" +
            '<span class="card__name">' + esc(p.name) + "</span>" +
            '<span class="card__note">' + esc(p.note) + "</span>" +
          "</span>" +
          '<span class="card__go">Edit &rsaquo;</span>' +
        "</button>"
      );
    }).join("") + "</div>";
  }

  function pageIcon(file) {
    const paths = {
      "index.html": "M3 11l9-8 9 8v10H3z",
      "about.html": "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0z",
      "issues.html": "M4 5h16v3H4zm0 5h16v3H4zm0 5h10v3H4z",
      "contact.html": "M3 5h18v14H3zm2 2v.5l7 4.5 7-4.5V7z",
      "donate.html": "M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z",
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (paths[file] || paths["issues.html"]) + '"/></svg>';
  }

  /* ========================================================================
     Pages: the editor
     ======================================================================== */
  async function openPage(file) {
    const meta = PAGES.filter((p) => p.file === file)[0];
    if (!meta) { location.hash = "#/pages"; return; }

    E.show("page");
    $("#page-form").innerHTML = '<div class="skeleton" style="height:60vh"></div>';

    let html;
    try {
      html = await readFile(file);
    } catch (err) {
      $("#page-form").innerHTML = '<div class="empty"><p>' + esc(err.message) + "</p></div>";
      return;
    }

    s.page = {
      file: file,
      name: meta.name,
      html: html,
      values: CMS.read(html),
      schema: CMS.schema(html),
    };
    s.dirty = false;
    setStatus(meta.name + " — as it is on the website now");
    renderForm();
    updatePreview();
  }

  function setStatus(text, warn) {
    const el = $("#page-status");
    el.textContent = text;
    el.style.color = warn ? "var(--warn)" : "";
  }

  /* ---------------------------------------------------------------- form -- */

  // Adding or removing an item redraws the form. Redrawing it must not close
  // the section being worked in, or throw the page back to the top.
  function refreshForm(focusSelector) {
    const open = {};
    $$("#page-form details").forEach(function (d) {
      open[d.querySelector("summary").firstChild.textContent.trim()] = d.open;
    });
    const y = window.scrollY;
    renderForm(open);
    window.scrollTo(0, y);
    if (focusSelector) {
      const el = $(focusSelector);
      if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    }
  }

  function renderForm(openState) {
    const groups = [];
    s.page.schema.forEach(function (field) {
      const name = field.group || "Page";
      let g = groups.filter((x) => x.name === name)[0];
      if (!g) { g = { name: name, fields: [] }; groups.push(g); }
      g.fields.push(field);
    });

    $("#page-form").innerHTML =
      '<p class="formlead">Change anything below and watch the page beside it. ' +
      'Nothing is on the website until you press Publish.</p>' +
      groups.map(function (g, i) {
        const isOpen = openState ? !!openState[g.name] : i < 2;
        return (
          '<details class="group"' + (isOpen ? " open" : "") + ">" +
            "<summary>" + esc(g.name) + '<span class="group__count">' + g.fields.length + "</span></summary>" +
            '<div class="group__body">' + g.fields.map(control).join("") + "</div>" +
          "</details>"
        );
      }).join("");
    $$("#page-form textarea").forEach(E.autogrow);
  }

  function control(field) {
    return field.kind === "list" ? listControl(field) : fieldControl(field, null, null);
  }

  // One field. `list`/`index` are set when it lives inside a repeating item.
  function fieldControl(field, list, index) {
    const value = list
      ? (s.page.values[list.path][index] || {})[field.path]
      : s.page.values[field.path];
    const id = "f_" + String(list ? list.path + "_" + index + "_" + field.path : field.path).replace(/\W/g, "_");
    const data = ' data-path="' + esc(field.path) + '" data-type="' + esc(field.type || "text") + '"' +
      (list ? ' data-list="' + esc(list.path) + '" data-index="' + index + '"' : "");

    const help = field.help ? '<p class="hint">' + esc(field.help) + "</p>" : "";
    const label = '<label for="' + id + '">' + esc(field.label) + "</label>";

    if (field.attr === "src") return photoControl(field, id, data, value, label, help);

    if (field.type === "url") {
      return '<div class="field">' + label +
        '<input class="input" id="' + id + '" type="text" list="link-choices" value="' +
        esc(value == null ? "" : value) + '"' + data + ">" + help + "</div>";
    }

    const text = CMS.toEditable(value, field.type);
    const long = field.type === "rich";
    const medium = field.type === "inline" || text.length > 70;

    if (long) {
      return '<div class="field">' + label +
        '<div class="toolbar" role="toolbar" aria-label="Formatting">' +
          '<button type="button" data-md2="h2" title="Heading">H</button>' +
          '<button type="button" data-md2="bold" title="Bold"><strong>B</strong></button>' +
          '<button type="button" data-md2="italic" title="Italic"><em>I</em></button>' +
          '<button type="button" data-md2="bullet" title="List">&bull;&nbsp;List</button>' +
          '<button type="button" data-md2="link" title="Link">Link</button>' +
        "</div>" +
        '<textarea class="input input--body" id="' + id + '" rows="10"' + data + ">" +
        esc(text) + "</textarea>" + help + "</div>";
    }

    if (medium) {
      return '<div class="field">' + label +
        '<textarea class="input" id="' + id + '" rows="2"' + data + ">" + esc(text) + "</textarea>" +
        help + "</div>";
    }

    return '<div class="field">' + label +
      '<input class="input" id="' + id + '" type="text" value="' + esc(text) + '"' + data + ">" +
      help + "</div>";
  }

  function photoControl(field, id, data, value, label, help) {
    const src = value ? "../" + value : "";
    return '<div class="field">' + label +
      '<div class="photofield">' +
        (src ? '<img src="' + esc(src) + '" alt="">' : '<div class="photofield__none">None</div>') +
        '<div class="photofield__side">' +
          '<code class="photofield__path">' + esc(value || "") + "</code>" +
          '<button class="btn" type="button" data-pick="' + esc(field.path) + '">Choose a photo</button>' +
        "</div>" +
      "</div>" +
      '<input type="hidden" id="' + id + '" value="' + esc(value || "") + '"' + data + ">" +
      help + "</div>";
  }

  function listControl(list) {
    const items = s.page.values[list.path] || [];
    return (
      '<div class="repeater" data-repeater="' + esc(list.path) + '">' +
        '<div class="repeater__head">' +
          "<label>" + esc(list.label) + "</label>" +
          '<span class="muted">' + items.length + " of " + list.max + "</span>" +
        "</div>" +
        (list.help ? '<p class="hint">' + esc(list.help) + "</p>" : "") +
        items.map(function (item, i) {
          return (
            '<div class="item">' +
              '<div class="item__bar">' +
                '<span class="item__n">' + esc(list.itemLabel || "Item") + " " + (i + 1) + "</span>" +
                '<span class="item__tools">' +
                  '<button class="icon" type="button" title="Move up" data-move="' + esc(list.path) + '" data-from="' + i + '" data-to="' + (i - 1) + '"' + (i === 0 ? " disabled" : "") + ">&uarr;</button>" +
                  '<button class="icon" type="button" title="Move down" data-move="' + esc(list.path) + '" data-from="' + i + '" data-to="' + (i + 1) + '"' + (i === items.length - 1 ? " disabled" : "") + ">&darr;</button>" +
                  '<button class="icon icon--warn" type="button" title="Remove" data-remove="' + esc(list.path) + '" data-index="' + i + '"' + (items.length <= (list.min || 1) ? " disabled" : "") + ">&times;</button>" +
                "</span>" +
              "</div>" +
              list.fields.map((f) => fieldControl(f, list, i)).join("") +
            "</div>"
          );
        }).join("") +
        (items.length < list.max
          ? '<button class="btn btn--add" type="button" data-add="' + esc(list.path) + '">Add ' +
            esc((list.itemLabel || "item").toLowerCase()) + "</button>"
          : "") +
      "</div>"
    );
  }

  /* ------------------------------------------------------------- preview -- */
  const PREVIEW_HOOK =
    "<style>[data-fade]{opacity:1!important;transform:none!important}" +
    "[data-cms],[data-cms-list],[data-cms-attr]{cursor:pointer}" +
    "[data-cms]:hover,[data-cms-list]:hover,[data-cms-attr]:hover{" +
    "outline:2px dashed rgba(237,36,36,.85);outline-offset:4px}" +
    ".cms-flash{outline:3px solid #ED2424!important;outline-offset:4px}</style>" +
    "<script>(function(){" +
    "document.addEventListener('click',function(e){" +
    "var el=e.target.closest('[data-cms],[data-cms-attr],[data-cms-list]');" +
    "e.preventDefault();e.stopPropagation();if(!el)return;" +
    "var p=el.getAttribute('data-cms')||el.getAttribute('data-cms-list')||" +
    "((el.getAttribute('data-cms-attr')||'').split(':')[1]||'').split(',')[0];" +
    "parent.postMessage({cms:'select',path:(p||'').trim()},'*');},true);" +
    "addEventListener('message',function(e){if(!e.data||e.data.cms!=='highlight')return;" +
    "var q='[data-cms=\"'+e.data.path+'\"],[data-cms-list=\"'+e.data.path+'\"]';" +
    "var el=document.querySelector(q);if(!el)return;" +
    "el.scrollIntoView({block:'center',behavior:'smooth'});" +
    "el.classList.add('cms-flash');setTimeout(function(){el.classList.remove('cms-flash');},1400);});" +
    "})();<\/script>";

  const updatePreview = E.debounce(function () {
    if (!s.page) return;
    const frame = $("#page-frame");
    let html = CMS.write(s.page.html, s.page.values);
    html = html.replace(
      /<link href="https:\/\/fonts\.googleapis\.com([^"]*)" rel="stylesheet">/,
      '<link href="https://fonts.googleapis.com$1" rel="stylesheet" media="print" onload="this.media=\'all\'">'
    );
    html = html.replace("<head>", '<head><base href="' + new URL("../", location.href).href + '">');
    html = html.replace("</body>", PREVIEW_HOOK + "</body>");
    const scroll = (function () { try { return frame.contentWindow.scrollY; } catch (e) { return 0; } })();
    frame.srcdoc = html;
    frame.onload = function () { try { frame.contentWindow.scrollTo(0, scroll); } catch (e) {} };
  }, 200);

  /* ------------------------------------------------------------- editing -- */
  function setValue(el) {
    const path = el.dataset.path;
    const type = el.dataset.type || "text";
    const html = el.type === "hidden" || type === "url"
      ? el.value
      : CMS.fromEditable(el.value, type);

    if (el.dataset.list) {
      const arr = s.page.values[el.dataset.list];
      arr[+el.dataset.index] = arr[+el.dataset.index] || {};
      arr[+el.dataset.index][path] = html;
    } else {
      s.page.values[path] = html;
    }
    s.dirty = true;
    setStatus("Not published yet — press Publish to put this on the website", true);
    updatePreview();
  }

  function blankItem(list) {
    const item = {};
    list.fields.forEach(function (f) {
      item[f.path] = f.attr === "src" ? (s.page.values[list.path][0] || {})[f.path] || ""
        : f.type === "url" ? "index.html"
        : CMS.fromEditable(f.attr === "alt" ? "" : "New " + String(f.label).toLowerCase(), f.type);
    });
    return item;
  }

  /* ----------------------------------------------------------- publishing -- */
  async function publishPage() {
    if (!E.canPublish()) { await E.requireSignin("publish this page"); return; }
    if (!s.dirty) { E.toast("Nothing has changed yet."); return; }

    const html = CMS.write(s.page.html, s.page.values);
    try {
      E.busy("Publishing…");
      await E.commitFiles([{ path: s.page.file, content: html }],
        "Update the " + s.page.name + " page" + who());
      s.page.html = html;
      s.dirty = false;
      const root = /^https?:/.test(location.origin) ? location.origin : E.config.siteUrl;
      const link = root + "/" + (s.page.file === "index.html" ? "" : s.page.file);
      E.busyDone('Published. <a href="' + esc(link) + '" target="_blank" rel="noopener">See the page</a>');
      setStatus(s.page.name + " — live on the website");
    } catch (err) {
      E.busyDone("Could not publish: " + err.message);
      setStatus("Not published", true);
    }
  }

  function who() {
    const u = E.state.user;
    return u ? " (" + (u.name || u.login) + ")" : "";
  }

  /* ========================================================================
     Photos
     ======================================================================== */
  async function openMedia() {
    E.show("media");
    $("#media-body").innerHTML = '<div class="skeleton" style="height:40vh"></div>';
    try {
      const lists = await Promise.all(IMG_DIRS.map(async function (dir) {
        try {
          const items = await E.gh(fileUrl(dir));
          return items.filter((f) => f.type === "file" && /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name))
            .map((f) => ({ path: f.path, name: f.name, size: f.size }));
        } catch (e) { return []; }
      }));
      s.media = [].concat.apply([], lists).sort((a, b) => a.path < b.path ? -1 : 1);
      renderMedia();
    } catch (err) {
      $("#media-body").innerHTML = '<div class="empty"><p>' + esc(err.message) + "</p></div>";
    }
  }

  function renderMedia() {
    const q = ($("#media-search").value || "").toLowerCase();
    const shown = (s.media || []).filter((m) => !q || m.path.toLowerCase().indexOf(q) > -1);
    $("#media-count").textContent = (s.media || []).length + " photos on the website";
    $("#media-body").innerHTML = E.signedOutNotice() +
      (s.pickingFor ? '<div class="notice">Choose a photo to use, or add a new one.</div>' : "") +
      (shown.length
        ? '<div class="grid">' + shown.map(function (m) {
            return (
              '<figure class="tile"' + (s.pickingFor ? ' data-use="' + esc(m.path) + '"' : "") + ">" +
                '<img src="../' + esc(m.path) + '" alt="" loading="lazy">' +
                "<figcaption>" + esc(m.name) +
                  '<span>' + Math.round((m.size || 0) / 1024) + " KB</span>" +
                "</figcaption>" +
                (s.pickingFor ? '<span class="tile__use">Use this</span>' : "") +
              "</figure>"
            );
          }).join("") + "</div>"
        : '<div class="empty"><p>No photos match that.</p></div>');
  }

  async function uploadMedia(files) {
    if (!E.canPublish()) { await E.requireSignin("add a photo"); return; }
    const list = Array.prototype.slice.call(files).filter((f) => /^image\//.test(f.type));
    if (!list.length) return;
    try {
      E.busy("Getting " + (list.length === 1 ? "the photo" : list.length + " photos") + " ready…");
      const commits = [];
      for (const file of list) {
        const ready = await E.prepareImage(file);
        const name = file.name.replace(/\.[^.]+$/, "").toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "photo";
        commits.push({
          path: "assets/img/" + name + "." + ready.ext,
          content: ready.base64,
          encoding: "base64",
        });
      }
      E.busy("Adding to the website…");
      await E.commitFiles(commits, "Add " + commits.length + " photo" + (commits.length === 1 ? "" : "s") + who());
      E.busyDone("Added.");
      await openMedia();
    } catch (err) {
      E.busyDone("Could not add: " + err.message);
    }
  }

  function usePhoto(path) {
    const target = s.pickingFor;
    s.pickingFor = null;
    if (!target || !s.page) { location.hash = "#/media"; return; }
    s.page.values[target] = path;
    s.dirty = true;
    location.hash = "#/page/" + encodeURIComponent(s.page.file);
    refreshForm();
    updatePreview();
    setStatus("Photo changed — press Publish to put it on the website", true);
  }

  /* ========================================================================
     Settings
     ======================================================================== */
  const SETTING_KEYS = [
    ["donateUrl", "Donation page", "Where the Donate buttons send people. The amount picked on the donate page is added to the end."],
    ["formEndpoint", "Form address", "Where the contact and signup forms send what people type. Leave blank and they open the visitor's email program instead."],
    ["email", "Campaign email", "Shown in the footer and on the contact page."],
    ["disclaimer", "Paid for by", "Required on political material. Must match the campaign's filing with the Secretary of State."],
  ];
  const SOCIAL_KEYS = [["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X (Twitter)"]];

  async function openSettings() {
    E.show("settings");
    $("#settings-body").innerHTML = '<div class="skeleton" style="height:40vh"></div>';
    try {
      const js = await readFile("assets/js/site.js");
      const index = await readFile("index.html");
      s.settings = {
        js: js,
        values: readSettings(js),
        nav: CMS.navRead(index),
        dirty: false,
      };
      renderSettings();
    } catch (err) {
      $("#settings-body").innerHTML = '<div class="empty"><p>' + esc(err.message) + "</p></div>";
    }
  }

  function readSettings(js) {
    const out = {};
    SETTING_KEYS.forEach(function (k) {
      const m = new RegExp(k[0] + ':\\s*"([^"]*)"').exec(js);
      out[k[0]] = m ? m[1] : "";
    });
    const social = /social:\s*\{([\s\S]*?)\}/.exec(js);
    SOCIAL_KEYS.forEach(function (k) {
      const m = social ? new RegExp(k[0] + ':\\s*"([^"]*)"').exec(social[1]) : null;
      out["social." + k[0]] = m ? m[1] : "";
    });
    return out;
  }

  function writeSettings(js, values) {
    let out = js;
    SETTING_KEYS.forEach(function (k) {
      out = out.replace(new RegExp("(" + k[0] + ':\\s*")[^"]*(")'), "$1" + jsSafe(values[k[0]]) + "$2");
    });
    const social = /social:\s*\{([\s\S]*?)\}/.exec(out);
    if (social) {
      let block = social[1];
      SOCIAL_KEYS.forEach(function (k) {
        block = block.replace(new RegExp("(" + k[0] + ':\\s*")[^"]*(")'), "$1" + jsSafe(values["social." + k[0]]) + "$2");
      });
      out = out.slice(0, social.index) + out.slice(social.index).replace(social[1], block);
    }
    return out;
  }

  const jsSafe = (v) => String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim();

  function renderSettings() {
    const v = s.settings.values;
    $("#settings-body").innerHTML = E.signedOutNotice() +
      '<div class="settings">' +
        '<details class="group" open><summary>The campaign<span class="group__count">' +
          (SETTING_KEYS.length + SOCIAL_KEYS.length) + "</span></summary>" +
        '<div class="group__body">' +
        SETTING_KEYS.map(function (k) {
          return '<div class="field"><label for="set_' + k[0] + '">' + esc(k[1]) + "</label>" +
            '<input class="input" id="set_' + k[0] + '" type="text" data-setting="' + k[0] + '" value="' +
            esc(v[k[0]]) + '"><p class="hint">' + esc(k[2]) + "</p></div>";
        }).join("") +
        SOCIAL_KEYS.map(function (k) {
          return '<div class="field"><label for="set_' + k[0] + '">' + esc(k[1]) + "</label>" +
            '<input class="input" id="set_' + k[0] + '" type="text" placeholder="Leave blank to hide the icon" ' +
            'data-setting="social.' + k[0] + '" value="' + esc(v["social." + k[0]]) + '"></div>';
        }).join("") +
        "</div></details>" +

        '<details class="group" open><summary>The menu<span class="group__count">' +
          s.settings.nav.length + "</span></summary>" +
        '<div class="group__body">' +
        '<p class="hint">The links across the top of every page. Changing them here changes ' +
        "every page at once, the news posts included.</p>" +
        '<div class="repeater">' +
        s.settings.nav.map(function (item, i) {
          return '<div class="item item--row">' +
            '<input class="input" type="text" data-nav="label" data-index="' + i + '" value="' + esc(item.label) + '" aria-label="Menu label">' +
            '<input class="input" type="text" list="link-choices" data-nav="href" data-index="' + i + '" value="' + esc(item.href) + '" aria-label="Menu link">' +
            '<span class="item__tools">' +
              '<button class="icon" type="button" data-navmove="' + i + '" data-to="' + (i - 1) + '"' + (i === 0 ? " disabled" : "") + ">&uarr;</button>" +
              '<button class="icon" type="button" data-navmove="' + i + '" data-to="' + (i + 1) + '"' + (i === s.settings.nav.length - 1 ? " disabled" : "") + ">&darr;</button>" +
              '<button class="icon icon--warn" type="button" data-navremove="' + i + '"' + (s.settings.nav.length <= 2 ? " disabled" : "") + ">&times;</button>" +
            "</span>" +
          "</div>";
        }).join("") +
        (s.settings.nav.length < 7 ? '<button class="btn btn--add" type="button" data-navadd>Add a menu item</button>' : "") +
        "</div></div></details>" +
      "</div>";
  }

  async function saveSettings() {
    if (!E.canPublish()) { await E.requireSignin("change the settings"); return; }
    if (!s.settings.dirty) { E.toast("Nothing has changed yet."); return; }

    try {
      E.busy("Reading the pages…");
      const files = [{ path: "assets/js/site.js", content: writeSettings(s.settings.js, s.settings.values) }];

      // The menu lives in every page, so every page is rewritten together.
      for (const file of NAV_PAGES) {
        let html;
        try { html = await readFile(file); } catch (e) { continue; }
        const updated = CMS.navWrite(html, s.settings.nav, file);
        if (updated !== html) files.push({ path: file, content: updated });
      }

      // News posts are generated from this template, so the menu lives here too.
      try {
        const tpl = await readFile("assets/js/post-template.js");
        const block = "const NAV = [\n" + s.settings.nav.map(function (n) {
          return '  ["' + jsSafe(n.href) + '", "' + jsSafe(n.label) + '"],';
        }).join("\n") + "\n];";
        const updated = tpl.replace(/const NAV = \[[\s\S]*?\n\];/, block);
        if (updated !== tpl) files.push({ path: "assets/js/post-template.js", content: updated });
      } catch (e) { /* the template is optional */ }

      E.busy("Publishing settings…");
      await E.commitFiles(files, "Update site settings" + who());
      s.settings.js = files[0].content;
      s.settings.dirty = false;
      E.busyDone("Settings published across " + files.length + " files. Live in a minute or two.");
    } catch (err) {
      E.busyDone("Could not save: " + err.message);
    }
  }

  /* ========================================================================
     Wiring
     ======================================================================== */
  function wire() {
    document.addEventListener("click", async function (ev) {
      const card = ev.target.closest("[data-page]");
      if (card) { location.hash = "#/page/" + encodeURIComponent(card.dataset.page); return; }

      const use = ev.target.closest("[data-use]");
      if (use) { usePhoto(use.dataset.use); return; }

      const pick = ev.target.closest("[data-pick]");
      if (pick) { s.pickingFor = pick.dataset.pick; location.hash = "#/media"; return; }

      const act = ev.target.closest("[data-action]");
      if (act) {
        const a = act.dataset.action;
        if (a === "pages-back") {
          if (s.dirty && !await E.confirmDialog({
            title: "Leave without publishing?",
            body: "The changes you made to this page are not on the website yet, and leaving loses them.",
            confirm: "Leave",
          })) return;
          s.dirty = false;
          location.hash = "#/pages";
        }
        if (a === "page-publish") publishPage();
        if (a === "page-revert") revertPage();
        if (a === "media-upload") $("#media-input").click();
        if (a === "settings-save") saveSettings();
      }

      const add = ev.target.closest("[data-add]");
      if (add) {
        const list = s.page.schema.filter((f) => f.path === add.dataset.add)[0];
        s.page.values[list.path].push(blankItem(list));
        s.dirty = true;
        updatePreview();
        refreshForm('[data-list="' + cssEscape(list.path) + '"][data-index="' +
                    (s.page.values[list.path].length - 1) + '"]');
        setStatus("Not published yet — press Publish to put this on the website", true);
      }

      const remove = ev.target.closest("[data-remove]");
      if (remove) {
        s.page.values[remove.dataset.remove].splice(+remove.dataset.index, 1);
        s.dirty = true; refreshForm(); updatePreview();
      }

      const move = ev.target.closest("[data-move]");
      if (move) {
        const arr = s.page.values[move.dataset.move];
        const to = +move.dataset.to;
        if (to >= 0 && to < arr.length) {
          arr.splice(to, 0, arr.splice(+move.dataset.from, 1)[0]);
          s.dirty = true;
          updatePreview();
          refreshForm('[data-move="' + cssEscape(move.dataset.move) + '"][data-from="' + to + '"]');
        }
      }

      const md = ev.target.closest("[data-md2]");
      if (md) { ev.preventDefault(); format(md); }

      const size = ev.target.closest("[data-size2]");
      if (size) {
        $$("[data-size2]").forEach((b) => b.classList.remove("is-active"));
        size.classList.add("is-active");
        $("#page-stage").dataset.size = size.dataset.size2;
      }

      const pane = ev.target.closest("[data-pane2]");
      if (pane) {
        $$("[data-pane2]").forEach((b) => b.classList.remove("is-active"));
        pane.classList.add("is-active");
        $("#page-panes").dataset.showing = pane.dataset.pane2;
      }

      // --- settings: the menu ---
      const navAdd = ev.target.closest("[data-navadd]");
      if (navAdd) { s.settings.nav.push({ label: "New link", href: "index.html" }); s.settings.dirty = true; renderSettings(); }
      const navRemove = ev.target.closest("[data-navremove]");
      if (navRemove) { s.settings.nav.splice(+navRemove.dataset.navremove, 1); s.settings.dirty = true; renderSettings(); }
      const navMove = ev.target.closest("[data-navmove]");
      if (navMove) {
        const to = +navMove.dataset.to;
        if (to >= 0 && to < s.settings.nav.length) {
          s.settings.nav.splice(to, 0, s.settings.nav.splice(+navMove.dataset.navmove, 1)[0]);
          s.settings.dirty = true; renderSettings();
        }
      }
    });

    document.addEventListener("input", function (ev) {
      const el = ev.target;
      if (el.dataset && el.dataset.path && s.page) { E.autogrow(el); setValue(el); return; }
      if (el.dataset && el.dataset.setting && s.settings) {
        s.settings.values[el.dataset.setting] = el.value;
        s.settings.dirty = true;
        return;
      }
      if (el.dataset && el.dataset.nav && s.settings) {
        s.settings.nav[+el.dataset.index][el.dataset.nav] = el.value;
        s.settings.dirty = true;
        return;
      }
      if (el.id === "media-search") renderMedia();
    });

    // Focusing a field points at it in the page beside you.
    document.addEventListener("focusin", function (ev) {
      const el = ev.target;
      if (!s.page || !el.dataset || !el.dataset.path) return;
      const path = el.dataset.list || el.dataset.path;
      const frame = $("#page-frame");
      try { frame.contentWindow.postMessage({ cms: "highlight", path: path }, "*"); } catch (e) {}
    });

    // Clicking the page beside you jumps to the field that controls it.
    window.addEventListener("message", function (ev) {
      if (!ev.data || ev.data.cms !== "select" || !s.page) return;
      const path = ev.data.path;
      const field = $('[data-path="' + cssEscape(path) + '"]') ||
        $('[data-repeater="' + cssEscape(path) + '"] [data-path]') ||
        $('[data-list="' + cssEscape(path) + '"]');
      if (!field) return;
      const group = field.closest("details");
      if (group) group.open = true;
      field.scrollIntoView({ block: "center", behavior: "smooth" });
      field.focus({ preventScroll: true });
    });

    $("#media-input").addEventListener("change", function () { uploadMedia(this.files); this.value = ""; });

    window.addEventListener("beforeunload", function (e) {
      if (!s.dirty && !(s.settings && s.settings.dirty)) return;
      e.preventDefault(); e.returnValue = "";
    });
  }

  const cssEscape = (v) => String(v).replace(/["\\]/g, "\\$&");

  async function revertPage() {
    if (!s.dirty) { E.toast("Nothing has changed yet."); return; }
    const ok = await E.confirmDialog({
      title: "Undo your changes?",
      body: "This page goes back to what is on the website now. Anything you have typed since opening it is lost.",
      confirm: "Undo them",
    });
    if (!ok) return;
    s.page.values = CMS.read(s.page.html);
    s.dirty = false;
    refreshForm(); updatePreview();
    setStatus(s.page.name + " — as it is on the website now");
  }

  function format(button) {
    const ta = button.closest(".field").querySelector("textarea");
    if (!ta) return;
    const kind = button.dataset.md2;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    if (kind === "bold" || kind === "italic") {
      const mark = kind === "bold" ? "**" : "*";
      ta.setRangeText(mark + (sel || kind) + mark, start, end, "end");
    } else if (kind === "link") {
      const url = prompt("Address to link to:", "https://");
      if (!url) return;
      ta.setRangeText("[" + (sel || "link text") + "](" + url + ")", start, end, "end");
    } else {
      const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
      const mark = kind === "h2" ? "## " : "- ";
      const block = ta.value.slice(lineStart, end) || "Text";
      ta.setRangeText(block.split("\n").map((l) => (l.indexOf(mark) === 0 ? l : mark + l)).join("\n"),
        lineStart, Math.max(end, lineStart), "end");
    }
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  }

  /* ========================================================================
     Routing
     ======================================================================== */
  async function route(path) {
    if (path.indexOf("/page/") === 0) { await openPage(decodeURIComponent(path.slice(6))); return; }
    if (path === "/media") { await openMedia(); return; }
    if (path === "/settings") { await openSettings(); return; }
    E.show("pages");
    renderPages();
  }

  function ready() {
    // A datalist so a link field offers the pages that exist.
    const dl = document.createElement("datalist");
    dl.id = "link-choices";
    dl.innerHTML = LINK_CHOICES.map((c) => '<option value="' + c + '">').join("");
    document.body.appendChild(dl);
    wire();
  }

  window.SitePages = { route: route, ready: ready };
})();
