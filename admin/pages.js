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

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const s = {
    page: null,        // {file, name, html, values, schema}
    dirty: false,
    restored: false,   // was unsaved work put back when this page opened?
    query: "",         // narrowing the form to the field being looked for
    media: null,
    pickingFor: null,  // {path, list, index} — the image field waiting for a photo
    previewReady: false,   // is the preview there and listening?
    previewHTML: "",   // what it is showing, for opening in a tab of its own
    settings: null,
  };

  /* ========================================================================
     Unsaved work

     A page is read from GitHub every time it is opened, so anything typed and
     not published used to disappear the moment somebody looked at a different
     page. It is kept here as it is typed instead, in this browser, and offered
     back when the page is opened again. Nothing about the website changes
     until Publish; this only means the work is still there to publish.
     ======================================================================== */
  const draftKey = (file) => "page." + file;

  const keepDraft = E.debounce(function () {
    if (!s.page || E.state.demo) return;
    E.store.set(draftKey(s.page.file), { values: s.page.values, at: Date.now() });
    markUnsaved();
  }, 500);

  function dropDraft(file) {
    E.store.remove(draftKey(file));
    markUnsaved();
  }

  const keepSettingsDraft = E.debounce(function () {
    if (!s.settings || E.state.demo) return;
    E.store.set("settings", {
      values: s.settings.values, nav: s.settings.nav, at: Date.now(),
    });
    markUnsaved();
  }, 500);

  // A dot beside Pages or Settings, so work left behind on another screen is
  // visible from wherever the writer happens to be.
  function markUnsaved() {
    const anyPage = PAGES.some((p) => E.store.get(draftKey(p.file), null));
    const settings = !!E.store.get("settings", null);
    const mark = function (section, on) {
      const link = $("#sections a[data-section='" + section + "']");
      if (link) link.classList.toggle("has-unsaved", !!on);
    };
    mark("pages", anyPage);
    mark("settings", settings);
  }

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

    // Returning to a page that is already open with unsaved work must not read
    // it back from GitHub — that would silently discard the work.
    if (s.page && s.page.file === file && s.dirty) {
      E.show("page");
      updatePreview();
      return;
    }

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
    s.restored = false;
    s.query = "";

    // Anything typed here before and never published is put back. It is laid
    // over what the website has now rather than replacing it, so a part of the
    // page that has changed in the meantime still arrives.
    const saved = E.store.get(draftKey(file), null);
    if (saved && saved.values && !same(saved.values, s.page.values)) {
      s.page.values = Object.assign({}, s.page.values, saved.values);
      s.dirty = true;
      s.restored = true;
      setStatus("Your unsaved changes from " + E.timeAgo(saved.at) + " — not on the website yet", true);
    } else {
      if (saved) dropDraft(file);
      setStatus(meta.name + " — as it is on the website now");
    }

    renderForm();
    updatePreview();
    markUnsaved();
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
      if (!g) { g = { name: name, fields: [], head: true }; groups.push(g); }
      if (!field.head) g.head = false;
      g.fields.push(field);
    });

    // What the visitor sees comes first. A group that exists only in the
    // <head> — the page title and the search-engine lines — is real work, but
    // it is not the reason anybody opens this page, so it goes to the bottom.
    const order = groups.filter((g) => !g.head).concat(groups.filter((g) => g.head));

    $("#page-form").innerHTML =
      // Everything here can be read and previewed signed out. Saying so up
      // front beats finding out at the moment somebody presses Publish.
      E.signedOutNotice() +
      (s.restored
        ? '<div class="notice notice--warn">Your unsaved changes are back, exactly ' +
          "as you left them. They are not on the website until you press Publish — " +
          '<button class="linklike" type="button" data-action="page-revert">' +
          "undo them</button> to go back to what is up now.</div>"
        : "") +
      '<p class="formlead">Change anything below and watch the page beside it. ' +
      'Nothing is on the website until you press Publish.</p>' +
      '<div class="formbar">' +
        '<input class="search" id="field-search" type="search" autocomplete="off" ' +
          'placeholder="Find a field on this page" aria-label="Find a field on this page" ' +
          'value="' + esc(s.query || "") + '">' +
        '<button class="ghost" type="button" data-action="expand-all">Expand all</button>' +
      "</div>" +
      '<p class="formcount" id="field-count" aria-live="polite"></p>' +
      order.map(function (g, i) {
        const isOpen = openState ? !!openState[g.name] : i < 2;
        return (
          '<details class="group"' + (isOpen ? " open" : "") + ">" +
            "<summary>" + esc(g.name) +
              '<span class="group__count" data-total="' + g.fields.length + '">' +
                g.fields.length + "</span></summary>" +
            '<div class="group__body">' + g.fields.map(control).join("") + "</div>" +
          "</details>"
        );
      }).join("");
    $$("#page-form textarea").forEach(E.autogrow);
    renderCount();
    if (s.query) filterFields(s.query);
  }

  // How much there is to change here, counted from what was actually drawn so
  // it cannot drift from the form beside it.
  function renderCount() {
    const count = $("#field-count");
    if (!count) return;
    const n = $$("#page-form .field").length;
    count.textContent = n + (n === 1 ? " thing" : " things") + " you can change on this page";
  }

  /* Nine groups and a hundred boxes is a lot to scroll past to change one
     line. Typing narrows it to the fields whose name, help or contents match,
     and opens whichever groups they are in. */
  function filterFields(query) {
    s.query = query;
    const q = query.trim().toLowerCase();
    const count = $("#field-count");

    if (!q) {
      $$("#page-form .field, #page-form .repeater, #page-form .item").forEach((el) => (el.hidden = false));
      $$("#page-form details").forEach((d) => d.classList.remove("is-empty"));
      $$("#page-form .group__count").forEach((b) => (b.textContent = b.dataset.total));
      renderCount();
      return;
    }

    let shown = 0;
    const matches = function (box) {
      const label = (box.querySelector("label") || {}).textContent || "";
      const hint = (box.querySelector(".hint") || {}).textContent || "";
      const input = box.querySelector("input, textarea");
      const value = input ? input.value : "";
      return (label + " " + hint + " " + value).toLowerCase().indexOf(q) > -1;
    };

    $$("#page-form .group").forEach(function (group) {
      let any = false;
      $$(".field", group).forEach(function (box) {
        // A field inside a repeating item is judged on its own, but an item is
        // kept whole when any of its fields match, so a card stays a card.
        const item = box.closest(".item");
        const hit = matches(box) || (item && $$(".field", item).some(matches));
        box.hidden = !hit;
        if (hit) { any = true; shown++; }
      });
      $$(".item", group).forEach(function (item) {
        item.hidden = !$$(".field", item).some((f) => !f.hidden);
      });
      $$(".repeater", group).forEach(function (rep) {
        rep.hidden = !$$(".field", rep).some((f) => !f.hidden);
      });
      // The badge counts what is in front of you, not what the group holds.
      const badge = group.querySelector(".group__count");
      const here = $$(".field", group).filter((f) => !f.hidden).length;
      if (badge) badge.textContent = here + " of " + badge.dataset.total;
      group.classList.toggle("is-empty", !any);
      if (any) group.open = true;
    });

    if (count) {
      count.textContent = shown
        ? shown + (shown === 1 ? " field matches " : " fields match ") + "“" + query.trim() + "”"
        : "Nothing on this page matches “" + query.trim() + "”";
    }
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
    // data-attr is the whole of how the rest of the file tells an attribute
    // apart from an element's content. Guessing it back from the kind of box
    // that got drawn used to write a button's link into the button's words.
    const data = ' data-path="' + esc(field.path) + '" data-type="' + esc(field.type || "text") + '"' +
      (field.attr ? ' data-attr="' + esc(field.attr) + '"' : "") +
      (list ? ' data-list="' + esc(list.path) + '" data-index="' + index + '"' : "");

    const help = field.help ? '<p class="hint">' + esc(field.help) + "</p>" : "";
    const label = '<label for="' + id + '">' + esc(field.label) + "</label>";

    if (field.attr === "src") return photoControl(field, id, data, value, label, help, list, index);

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

  function photoControl(field, id, data, value, label, help, list, index) {
    const src = value ? "../" + value : "";
    // Which item's photo this is, so choosing one for the third card does not
    // land on the first — or, worse, on nothing at all.
    const where = list ? ' data-pick-list="' + esc(list.path) + '" data-pick-index="' + index + '"' : "";
    return '<div class="field">' + label +
      '<div class="photofield">' +
        (src
          ? '<img src="' + esc(src) + '" alt="" loading="lazy">'
          : '<div class="photofield__none">None</div>') +
        '<div class="photofield__side">' +
          '<code class="photofield__path">' + esc(value || "No photo chosen") + "</code>" +
          '<button class="btn" type="button" data-pick="' + esc(field.path) + '"' + where + ">" +
            (value ? "Change photo" : "Choose a photo") + "</button>" +
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
  /* The script that rides along inside the preview. It does three jobs: it
     reports what was clicked (with the list item it belongs to, so the third
     card is not mistaken for the first), it scrolls to whatever the editor is
     pointing at, and it accepts a single field's new content so that typing
     never has to reload the page underneath the reader. */
  const PREVIEW_HOOK = [
    "<style>",
    "[data-fade]{opacity:1!important;transform:none!important}",
    "[data-cms],[data-cms-list],[data-cms-attr]{cursor:pointer}",
    "[data-cms]:hover,[data-cms-attr]:hover{outline:2px dashed rgba(237,36,36,.85);outline-offset:4px}",
    ".cms-flash{outline:3px solid #ED2424!important;outline-offset:4px;",
    "transition:outline-color .3s ease}",
    "</style>",
    "<script>(function(){",

    // The items of one list, in document order.
    "function items(list){",
    "if(!list)return[];",
    "return [].slice.call(list.querySelectorAll('[data-cms-item]')).filter(function(it){",
    "return it.closest('[data-cms-list]')===list;});}",

    // Does this element carry that path — as its content, or as one of the
    // attributes it exposes? An exact answer: "amount" must not match a
    // neighbouring "amountNote", and a repeating item is usually the element
    // itself rather than something inside it.
    "function owns(el,path){",
    "if(!el||!el.getAttribute)return false;",
    "if(el.getAttribute('data-cms')===path)return true;",
    "var a=el.getAttribute('data-cms-attr');if(!a)return false;",
    "for(var p=a.split(','),i=0;i<p.length;i++)",
    "if((p[i].split(':')[1]||'').trim()===path)return true;",
    "return false;}",

    // The element a path (plus optional list and index) points at.
    "function find(m){",
    "var list=m.list?document.querySelector('[data-cms-list=\"'+m.list+'\"]'):null;",
    "var scope=document;",
    "if(list&&m.index!=null){var it=items(list)[m.index];if(!it)return list;scope=it;}",
    "else if(list&&!m.path)return list;",
    "if(!m.path)return list;",
    "if(scope!==document&&owns(scope,m.path))return scope;",
    "var all=scope.querySelectorAll('[data-cms],[data-cms-attr]');",
    "for(var i=0;i<all.length;i++)if(owns(all[i],m.path))return all[i];",
    "return list;}",

    // Clicking anything editable tells the editor which field it was.
    "document.addEventListener('click',function(e){",
    "var el=e.target.closest('[data-cms],[data-cms-attr]');",
    "e.preventDefault();e.stopPropagation();",
    "if(!el)return;",
    "var path=el.getAttribute('data-cms')||",
    "((el.getAttribute('data-cms-attr')||'').split(':')[1]||'').split(',')[0];",
    "var item=el.closest('[data-cms-item]');",
    "var list=item?item.closest('[data-cms-list]'):null;",
    "parent.postMessage({cms:'select',path:(path||'').trim(),",
    "list:list?list.getAttribute('data-cms-list'):null,",
    "index:list?items(list).indexOf(item):null},'*');},true);",

    "addEventListener('message',function(e){",
    "var m=e.data;if(!m||!m.cms||m.cms==='ready')return;",

    // The editor is pointing at a field: show where it is.
    "if(m.cms==='highlight'){",
    "var el=find(m);if(!el)return;",
    "var box=el.getBoundingClientRect();",
    "if(box.top<0||box.bottom>innerHeight)",
    "el.scrollIntoView({block:'center',behavior:'smooth'});",
    "el.classList.add('cms-flash');",
    "clearTimeout(el.__flash);",
    "el.__flash=setTimeout(function(){el.classList.remove('cms-flash');},1200);",
    "return;}",

    // One field changed: put the new content in without reloading anything.
    "if(m.cms==='set'){",
    "var t=find(m);if(!t)return;",
    "if(m.attr){t.setAttribute(m.attr,m.value);}",
    "else{t.innerHTML=m.value;}",
    "return;}",
    "});",
    "})();<\/script>",
  ].join("");

  // A full redraw. Only for changes the page's shape depends on — adding,
  // removing or reordering items, a new photo, or opening a page. Typing goes
  // through patchPreview instead, which leaves the reader where they were.
  const updatePreview = E.debounce(function () {
    if (!s.page) return;
    const frame = $("#page-frame");
    const scroll = E.frameScroll(frame);

    let html = CMS.write(s.page.html, s.page.values);
    html = html.replace(
      /<link href="https:\/\/fonts\.googleapis\.com([^"]*)" rel="stylesheet">/,
      '<link href="https://fonts.googleapis.com$1" rel="stylesheet" media="print" onload="this.media=\'all\'">'
    );
    html = html.replace("<head>", '<head><base href="' + E.siteRoot() + '">');
    html = html.replace("</body>", PREVIEW_HOOK + E.scrollKeeper(scroll, true) + "</body>");

    s.previewReady = false;
    s.previewHTML = html;
    frame.srcdoc = html;
  }, 200);

  // One field's new content, handed straight to the preview. Nothing reloads,
  // so the place the reader is looking at, and the box they are typing in, both
  // stay exactly where they were.
  function patchPreview(el) {
    if (!s.page) return;
    // Nothing is listening yet, and postMessage would go nowhere: redraw
    // instead, so an edit made the moment a page opens is not lost.
    if (!s.previewReady) { updatePreview(); return; }
    const frame = $("#page-frame");
    try {
      frame.contentWindow.postMessage({
        cms: "set",
        path: el.dataset.path,
        list: el.dataset.list || null,
        index: el.dataset.index != null ? +el.dataset.index : null,
        attr: el.dataset.attr || null,
        value: valueOf(el),
      }, "*");
    } catch (e) { updatePreview(); }
  }

  // What goes into the file. An attribute is stored exactly as typed — the
  // writer escapes attributes itself, and escaping here as well turned an
  // ampersand in a link into &amp;amp;.
  function valueOf(el) {
    if (el.dataset.attr) return el.value;
    return CMS.fromEditable(el.value, el.dataset.type || "text");
  }

  /* ------------------------------------------------------------- editing -- */
  function setValue(el) {
    const path = el.dataset.path;
    const html = valueOf(el);

    if (el.dataset.list) {
      const arr = s.page.values[el.dataset.list];
      arr[+el.dataset.index] = arr[+el.dataset.index] || {};
      arr[+el.dataset.index][path] = html;
    } else {
      s.page.values[path] = html;
    }
    touched(el);
    patchPreview(el);
  }

  // One place for "this page now differs from the website": the flag, the
  // line in the bar, and the copy kept on this computer.
  function touched(el) {
    s.dirty = true;
    setStatus("Not published yet — press Publish to put this on the website", true);
    keepDraft();
    if (el) {
      const box = el.closest(".field") || el.closest(".item");
      if (box) box.classList.add("is-changed");
    }
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
      s.restored = false;
      dropDraft(s.page.file);
      $$("#page-form .is-changed").forEach((el) => el.classList.remove("is-changed"));
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
      (s.pickingFor
        ? '<div class="notice">Choose the photo for <strong>' +
          esc(pickingLabel()) + "</strong>, or add a new one. " +
          '<button class="linklike" type="button" data-action="picking-cancel">Never mind</button></div>'
        : "") +
      (shown.length
        ? '<div class="grid">' + shown.map(function (m) {
            return (
              '<figure class="tile"' + (s.pickingFor ? ' data-use="' + esc(m.path) + '"' : "") + ">" +
                '<img src="../' + esc(m.path) + '" alt="" loading="lazy">' +
                '<figcaption title="' + esc(m.path) + '">' +
                  '<span class="tile__name">' + esc(m.name) + "</span>" +
                  "<span>" + fileSize(m.size) + "</span>" +
                "</figcaption>" +
                (s.pickingFor
                  ? '<span class="tile__use">Use this</span>'
                  : '<button class="tile__remove" type="button" title="Remove this photo" ' +
                    'aria-label="Remove ' + esc(m.name) + '" data-del-photo="' + esc(m.path) + '">&times;</button>') +
              "</figure>"
            );
          }).join("") + "</div>"
        : '<div class="empty"><p>No photos match that.</p></div>');
  }

  // The name of the field a photo is being chosen for, as the editor calls it.
  function pickingLabel() {
    if (!s.pickingFor || !s.page) return "this photo";
    const inList = s.pickingFor.list;
    const fields = inList
      ? ((s.page.schema.filter((f) => f.path === inList)[0] || {}).fields || [])
      : s.page.schema;
    const field = fields.filter((f) => f.path === s.pickingFor.path)[0];
    const where = s.page.name + (inList && s.pickingFor.index != null ? " · item " + (s.pickingFor.index + 1) : "");
    return (field ? field.label : "this photo") + " on " + where;
  }

  // "0 KB" beside a picture that plainly exists reads like something is wrong.
  const fileSize = (bytes) => (!bytes ? "" : bytes < 1024 ? "under 1 KB" : Math.round(bytes / 1024) + " KB");

  async function uploadMedia(files) {
    if (!E.canPublish()) { await E.requireSignin("add a photo"); return; }
    const list = Array.prototype.slice.call(files).filter((f) => /^image\//.test(f.type));
    if (!list.length) return;
    try {
      E.busy("Getting " + (list.length === 1 ? "the photo" : list.length + " photos") + " ready…");
      const commits = [];
      const taken = (s.media || []).map((m) => m.path);
      for (const file of list) {
        const ready = await E.prepareImage(file);
        const name = file.name.replace(/\.[^.]+$/, "").toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "photo";
        // Two photos off a phone are both called "img-1234". Landing the second
        // one on top of the first would change a picture on a page nobody was
        // even looking at, so a name already in use gets a number.
        let path = "assets/img/" + name + "." + ready.ext;
        for (let n = 2; taken.indexOf(path) > -1; n++) {
          path = "assets/img/" + name + "-" + n + "." + ready.ext;
        }
        taken.push(path);
        commits.push({ path: path, content: ready.base64, encoding: "base64" });
      }
      E.busy("Adding to the website…");
      await E.commitFiles(commits, "Add " + commits.length + " photo" + (commits.length === 1 ? "" : "s") + who());
      E.busyDone("Added.");
      await openMedia();
    } catch (err) {
      E.busyDone("Could not add: " + err.message);
    }
  }

  /* A photo still shown somewhere must not disappear without warning, so the
     pages and the posts are read and searched before anything is removed. */
  async function photoUses(photoPath) {
    const where = [];
    const look = function (text, name) {
      if (text && text.indexOf(photoPath) > -1 && where.indexOf(name) === -1) where.push(name);
    };

    for (const page of PAGES) {
      try { look(await readFile(page.file), page.name); } catch (e) { /* skip */ }
    }
    try {
      const posts = await E.gh(fileUrl("content/news"));
      for (const f of posts.filter((x) => x.type === "file" && /\.md$/i.test(x.name))) {
        try { look(await readFile(f.path), "the post “" + f.name.replace(/\.md$/i, "") + "”"); }
        catch (e) { /* skip */ }
      }
    } catch (e) { /* the news folder is optional */ }

    return where;
  }

  async function deletePhoto(photoPath) {
    if (!E.canPublish()) { await E.requireSignin("remove a photo"); return; }

    E.busy("Checking where this photo is used…");
    let used = [];
    try { used = await photoUses(photoPath); } catch (e) { /* fall through to the warning */ }
    E.busyDone("");

    const name = photoPath.split("/").pop();
    const ok = await E.confirmDialog({
      title: "Remove “" + name + "”?",
      body: used.length
        ? "This photo is still being used on " + listWords(used) + ". Removing it leaves " +
          "a broken picture there until you choose another one. Change those first if you can."
        : "It is not used anywhere on the website, so removing it changes nothing " +
          "visitors can see. It stays in the site's history and can be brought back.",
      confirm: used.length ? "Remove it anyway" : "Remove it",
      danger: true,
    });
    if (!ok) return;

    try {
      E.busy("Removing…");
      await E.commitFiles([{ path: photoPath, remove: true }], "Remove photo: " + name + who());
      E.busyDone("Removed.");
      await openMedia();
    } catch (err) {
      E.busyDone("Could not remove: " + err.message);
    }
  }

  // "the Home page", "the Home page and the About page", "A, B and C".
  function listWords(items) {
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function usePhoto(path) {
    const target = s.pickingFor;
    s.pickingFor = null;
    if (!target || !s.page) { location.hash = "#/media"; return; }

    if (target.list) {
      const arr = s.page.values[target.list] || [];
      arr[target.index] = arr[target.index] || {};
      arr[target.index][target.path] = path;
    } else {
      s.page.values[target.path] = path;
    }
    touched();

    // Back to the page by hand rather than through the address bar. Setting the
    // hash would send the router through openPage again, which re-reads the
    // file from GitHub — and that would throw away this photo along with
    // everything else typed since the page was opened.
    history.replaceState(null, "", "#/page/" + encodeURIComponent(s.page.file));
    E.show("page");
    refreshForm();
    updatePreview();
    setStatus("Photo changed — press Publish to put it on the website", true);
    E.toast("Photo changed. Press Publish to put it on the website.");
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
      const live = { values: readSettings(js), nav: CMS.navRead(index) };
      s.settings = {
        js: js,
        values: live.values,
        nav: live.nav,
        // What the website says now, kept aside so the editor can name what is
        // about to change rather than asking for a yes to twelve unnamed files.
        live: JSON.parse(JSON.stringify(live)),
        dirty: false,
        restored: false,
      };

      const saved = E.store.get("settings", null);
      if (saved && saved.values && !same(saved, { values: s.settings.values, nav: s.settings.nav, at: saved.at })) {
        s.settings.values = Object.assign({}, s.settings.values, saved.values);
        if (saved.nav && saved.nav.length) s.settings.nav = saved.nav;
        s.settings.dirty = true;
        s.settings.restored = E.timeAgo(saved.at);
      } else if (saved) {
        E.store.remove("settings");
      }

      renderSettings();
      markUnsaved();
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
      (s.settings.restored
        ? '<div class="notice notice--warn">Your unsaved changes from ' +
          esc(s.settings.restored) + " are back. They are not on the website " +
          "until you press Publish settings.</div>"
        : "") +
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

  function settingsTouched(el) {
    s.settings.dirty = true;
    keepSettingsDraft();
    const box = el && (el.closest(".field") || el.closest(".item"));
    if (box) box.classList.add("is-changed");
  }

  // What is different from the website, in words. The menu counts as one
  // change however many links moved, because that is how it reads to a reader.
  function settingsChanges() {
    const out = [];
    const live = s.settings.live;
    SETTING_KEYS.concat(SOCIAL_KEYS.map((k) => ["social." + k[0], k[1]]))
      .forEach(function (k) {
        if ((s.settings.values[k[0]] || "") !== (live.values[k[0]] || "")) {
          out.push(k[1] + " — " + (s.settings.values[k[0]] ? "now “" + s.settings.values[k[0]] + "”" : "cleared"));
        }
      });
    const was = live.nav.map((n) => n.label + " → " + n.href).join(" | ");
    const now = s.settings.nav.map((n) => n.label + " → " + n.href).join(" | ");
    if (was !== now) {
      out.push("The menu — " + s.settings.nav.map((n) => n.label).join(", ") +
        " (changes on every page at once)");
    }
    return out;
  }

  async function saveSettings() {
    if (!E.canPublish()) { await E.requireSignin("change the settings"); return; }
    if (!s.settings.dirty) { E.toast("Nothing has changed yet."); return; }

    const changes = settingsChanges();
    const go = await E.confirmDialog({
      title: changes.length === 1 ? "Publish this change?" : "Publish these " + changes.length + " changes?",
      body: "These apply to every page on the website at once. Nothing else on any " +
            "page is touched, and this can be undone like any other change.",
      list: changes,
      confirm: "Publish them",
    });
    if (!go) return;

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
      E.store.remove("settings");
      markUnsaved();
      $$("#settings-body .is-changed").forEach((el) => el.classList.remove("is-changed"));
      E.busyDone("Settings published across " + files.length +
        " file" + (files.length === 1 ? "" : "s") + ". Live in a minute or two.");
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

      const del = ev.target.closest("[data-del-photo]");
      if (del) { ev.stopPropagation(); deletePhoto(del.dataset.delPhoto); return; }

      const use = ev.target.closest("[data-use]");
      if (use) { usePhoto(use.dataset.use); return; }

      const pick = ev.target.closest("[data-pick]");
      if (pick) {
        s.pickingFor = {
          path: pick.dataset.pick,
          list: pick.dataset.pickList || null,
          index: pick.dataset.pickIndex != null ? +pick.dataset.pickIndex : null,
        };
        location.hash = "#/media";
        return;
      }

      const act = ev.target.closest("[data-action]");
      if (act) {
        const a = act.dataset.action;
        if (a === "pages-back") {
          if (s.dirty) E.toast("Your changes are kept here, but they are not on the website yet.");
          location.hash = "#/pages";
        }
        if (a === "expand-all") {
          const shut = $$("#page-form details").filter((d) => !d.open && !d.classList.contains("is-empty"));
          $$("#page-form details").forEach((d) => (d.open = shut.length > 0));
          act.textContent = shut.length > 0 ? "Collapse all" : "Expand all";
        }
        if (a === "page-publish") publishPage();
        if (a === "page-revert") revertPage();
        if (a === "media-upload") $("#media-input").click();
        if (a === "picking-cancel") {
          const back = s.page ? "#/page/" + encodeURIComponent(s.page.file) : "#/pages";
          s.pickingFor = null;
          location.hash = back;
        }
        if (a === "settings-save") saveSettings();
      }

      const add = ev.target.closest("[data-add]");
      if (add) {
        const list = s.page.schema.filter((f) => f.path === add.dataset.add)[0];
        s.page.values[list.path].push(blankItem(list));
        touched();
        updatePreview();
        refreshForm('[data-list="' + cssEscape(list.path) + '"][data-index="' +
                    (s.page.values[list.path].length - 1) + '"]');
      }

      const remove = ev.target.closest("[data-remove]");
      if (remove) {
        s.page.values[remove.dataset.remove].splice(+remove.dataset.index, 1);
        touched();
        refreshForm();
        updatePreview();
      }

      const move = ev.target.closest("[data-move]");
      if (move) {
        const arr = s.page.values[move.dataset.move];
        const to = +move.dataset.to;
        if (to >= 0 && to < arr.length) {
          arr.splice(to, 0, arr.splice(+move.dataset.from, 1)[0]);
          touched();
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
      if (el.id === "field-search" && s.page) { filterFields(el.value); return; }
      if (el.dataset && el.dataset.path && s.page) { E.autogrow(el); setValue(el); return; }
      if (el.dataset && el.dataset.setting && s.settings) {
        s.settings.values[el.dataset.setting] = el.value;
        settingsTouched(el);
        return;
      }
      if (el.dataset && el.dataset.nav && s.settings) {
        s.settings.nav[+el.dataset.index][el.dataset.nav] = el.value;
        settingsTouched(el);
        return;
      }
      if (el.id === "media-search") renderMedia();
    });

    // Focusing a field points at it in the page beside you — at the third card
    // when it is the third card's field, not merely at the run of cards.
    document.addEventListener("focusin", function (ev) {
      const el = ev.target;
      if (!s.page || !el.dataset || !el.dataset.path) return;
      const frame = $("#page-frame");
      try {
        frame.contentWindow.postMessage({
          cms: "highlight",
          path: el.dataset.path,
          list: el.dataset.list || null,
          index: el.dataset.index != null ? +el.dataset.index : null,
        }, "*");
      } catch (e) { /* the preview is still loading */ }
    });

    // Clicking the page beside you jumps to the field that controls it. Inside a
    // repeating region that means the field of the item actually clicked.
    window.addEventListener("message", function (ev) {
      if (!ev.data || !ev.data.cms) return;
      // The preview announces itself from inside, while it is still parsing.
      // From that moment typing can be handed straight to it instead of
      // redrawing the whole page underneath the reader.
      if (ev.data.cms === "ready") { s.previewReady = true; return; }
      if (ev.data.cms !== "select" || !s.page) return;
      const d = ev.data;
      const p = cssEscape(d.path || "");

      const field =
        (d.list != null && d.index != null
          ? $('[data-list="' + cssEscape(d.list) + '"][data-index="' + d.index + '"][data-path="' + p + '"]') ||
            $('[data-list="' + cssEscape(d.list) + '"][data-index="' + d.index + '"]')
          : null) ||
        $('[data-path="' + p + '"]') ||
        $('[data-repeater="' + p + '"] [data-path]') ||
        $('[data-list="' + p + '"]');
      if (!field) return;

      const group = field.closest("details");
      if (group) group.open = true;

      // A photo is a hidden field standing for an attribute: there is nothing
      // to put a cursor in, so the whole box is shown and marked instead.
      const box = field.closest(".field") || field;
      box.scrollIntoView({ block: "center", behavior: "smooth" });
      if (field.type !== "hidden") field.focus({ preventScroll: true });

      // A moment's outline, so it is obvious which box was landed on.
      box.classList.add("is-found");
      clearTimeout(box.__found);
      box.__found = setTimeout(() => box.classList.remove("is-found"), 1200);
    });

    $("#media-input").addEventListener("change", function () { uploadMedia(this.files); this.value = ""; });

    // Leaving the library without choosing means the request is off. Left set,
    // it would greet the next visit with an instruction to pick a photo for a
    // field nobody is looking at.
    window.addEventListener("hashchange", function () {
      if (location.hash.replace(/^#/, "") !== "/media") s.pickingFor = null;
    });

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
    s.restored = false;
    dropDraft(s.page.file);
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
    markUnsaved();
    // A datalist so a link field offers the pages that exist.
    const dl = document.createElement("datalist");
    dl.id = "link-choices";
    dl.innerHTML = LINK_CHOICES.map((c) => '<option value="' + c + '">').join("");
    document.body.appendChild(dl);
    wire();
  }

  window.SitePages = {
    route: route,
    ready: ready,
    pages: PAGES,
    previewHTML: () => s.previewHTML,
  };
})();
