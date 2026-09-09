/* ==========================================================================
   admin/admin.js — the website editor.

   What this is: a single page that reads and writes the Markdown files in
   content/news/ through GitHub's API. There is no server, no database and no
   build step. Publishing is one commit; the existing GitHub Action turns that
   commit into the live pages, feed and sitemap a minute later.

   The preview is not a lookalike. It calls assets/js/post-template.js — the
   same function that writes the published page — and assets/js/site.js for
   the news card. What the writer sees is what goes up.
   ========================================================================== */

(function () {
  "use strict";

  /* ========================================================================
     Settings

     Change these if the repository is renamed or moved, or set them from the
     Help panel, which stores an override in this browser.
     ======================================================================== */
  const DEFAULTS = {
    owner: "williamhodgesiii-bit",
    repo: "RepLeighHulsey",
    branch: "main",
    siteUrl: "https://hulseyforhouse.com",
    siteName: "Hulsey for House",
  };

  const NEWS_DIR = "content/news";
  const IMG_DIR = "assets/img/news";
  const PREVIEW_IMG = "assets/img/news/__preview__";   // stands in for a photo not uploaded yet
  const MAX_IMAGE_WIDTH = 1600;
  const STORE = "hfh.editor.";

  /* ========================================================================
     Small helpers
     ======================================================================== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = MD.escapeHTML;

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(STORE + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch (e) {}
    },
    remove(key) {
      try { localStorage.removeItem(STORE + key); } catch (e) {}
    },
  };

  const config = Object.assign({}, DEFAULTS, store.get("config", {}));
  const REPO = () => config.owner + "/" + config.repo;

  const today = () => new Date().toISOString().slice(0, 10);

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function niceDate(iso) {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[+p[1] - 1] + " " + +p[2] + ", " + p[0];
  }

  /* ========================================================================
     State
     ======================================================================== */
  const state = {
    token: store.get("token", ""),
    user: null,
    demo: false,
    posts: null,          // [{slug, meta, body, sha}]
    filter: "all",
    query: "",
    editing: null,        // the post open in the editor
    dirty: false,
    pendingImage: null,   // {base64, mime, dataUrl, ext, note}
    previewTab: "page",
    previewSize: "desktop",
    oauth: false,
  };

  /* ========================================================================
     GitHub
     ======================================================================== */
  async function gh(path, options) {
    const opts = options || {};
    const headers = Object.assign({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }, opts.headers || {});
    if (state.token) headers.Authorization = "Bearer " + state.token;
    if (opts.body) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch("https://api.github.com" + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body,
      });
    } catch (e) {
      // fetch only rejects when the request never got there at all.
      throw new Error("Could not reach GitHub. Check the internet connection and try again.");
    }

    if (res.status === 401) {
      signOut(true);
      throw new Error("Your sign-in has expired. Please sign in again.");
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch (e) {}
      const err = new Error(detail || ("GitHub said " + res.status));
      err.status = res.status;
      throw err;
    }
    return opts.raw ? res.text() : res.json();
  }

  const ghRaw = (path) => gh(path, { headers: { Accept: "application/vnd.github.raw" }, raw: true });

  /* One commit, however many files. Doing it through the git data API rather
     than one PUT per file means a post and its photograph land together — the
     site is never briefly pointing at an image that has not arrived. */
  async function commitFiles(files, message) {
    const ref = await gh(`/repos/${REPO()}/git/ref/heads/${config.branch}`);
    const baseSha = ref.object.sha;
    const baseCommit = await gh(`/repos/${REPO()}/git/commits/${baseSha}`);

    const tree = [];
    for (const file of files) {
      if (file.remove) {
        tree.push({ path: file.path, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const blob = await gh(`/repos/${REPO()}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: file.encoding || "utf-8" }),
      });
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await gh(`/repos/${REPO()}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: tree }),
    });
    const commit = await gh(`/repos/${REPO()}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: message, tree: newTree.sha, parents: [baseSha] }),
    });
    await gh(`/repos/${REPO()}/git/refs/heads/${config.branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
    return commit.sha;
  }

  async function loadPosts() {
    const listing = await gh(`/repos/${REPO()}/contents/${NEWS_DIR}?ref=${encodeURIComponent(config.branch)}`);
    const files = listing.filter((f) => f.type === "file" && /\.md$/i.test(f.name) && f.name[0] !== "_");

    const posts = await Promise.all(files.map(async (file) => {
      const text = await ghRaw(`/repos/${REPO()}/contents/${file.path}?ref=${encodeURIComponent(config.branch)}`);
      const parsed = MD.parseFrontMatter(text);
      return {
        slug: file.name.replace(/\.md$/i, ""),
        path: file.path,
        sha: file.sha,
        meta: parsed.meta,
        body: parsed.body,
      };
    }));

    posts.sort((a, b) => (a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : 0));
    state.posts = posts;
    return posts;
  }

  /* Has someone else changed this post since it was opened? */
  async function currentSha(path) {
    try {
      const meta = await gh(`/repos/${REPO()}/contents/${path}?ref=${encodeURIComponent(config.branch)}`);
      return meta.sha;
    } catch (e) {
      return null;
    }
  }

  /* The build Action turns a commit into pages. Watching it lets the editor
     say "live" when it is actually live rather than guessing. */
  async function waitForBuild(onStage) {
    const started = Date.now();
    await new Promise((r) => setTimeout(r, 4000));
    while (Date.now() - started < 180000) {
      try {
        const runs = await gh(`/repos/${REPO()}/actions/runs?branch=${encodeURIComponent(config.branch)}&per_page=3`);
        const run = (runs.workflow_runs || [])[0];
        if (run && run.status === "completed" && new Date(run.created_at).getTime() > started - 120000) {
          return run.conclusion === "success";
        }
        if (run && run.status !== "completed") onStage("Building the page…");
      } catch (e) {
        return null;   // no permission to watch, or offline: not an error worth showing
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return null;
  }

  /* ========================================================================
     Sign in
     ======================================================================== */
  async function probeOAuth() {
    try {
      const res = await fetch("/api/github-auth?probe=1", { headers: { Accept: "application/json" } });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.configured;
    } catch (e) { return false; }
  }

  function renderSignin() {
    const card = $("#signin-card");
    if (state.oauth) {
      card.innerHTML =
        '<h2>Sign in</h2>' +
        '<p class="muted">Use the GitHub account the campaign added you to. ' +
        'Nothing else to set up.</p>' +
        '<p style="margin-top:1rem"><a class="btn btn--primary btn--lg" href="/api/github-auth?start=1">Sign in with GitHub</a></p>';
      return;
    }

    const tokenUrl = "https://github.com/settings/tokens/new?scopes=repo&description=" +
      encodeURIComponent(config.siteName + " website editor");

    card.innerHTML =
      '<h2>One-time setup</h2>' +
      '<p class="muted">The editor needs permission to update the website. ' +
      'You do this once on this computer.</p>' +
      '<ol>' +
        '<li>Press <strong>Get my access key</strong> below. GitHub opens in a new tab with everything filled in.</li>' +
        '<li>Under <strong>Expiration</strong> choose how long it should last, then scroll down and press <strong>Generate token</strong>.</li>' +
        '<li>Copy the key GitHub shows you and paste it here. It is the only time GitHub will show it.</li>' +
      '</ol>' +
      '<p><a class="btn" href="' + tokenUrl + '" target="_blank" rel="noopener">Get my access key</a></p>' +
      '<div class="keyrow">' +
        '<input class="input" id="token-input" type="password" placeholder="Paste your key here" autocomplete="off" spellcheck="false">' +
        '<button class="btn btn--primary" type="button" data-action="signin">Sign in</button>' +
      '</div>' +
      '<p class="hint">The key stays in this browser and is never sent anywhere except GitHub. ' +
      'Signing out removes it.</p>';
  }

  async function signIn(token) {
    state.token = token.trim();
    if (!state.token) return;
    try {
      const user = await gh("/user");
      state.user = user;
      store.set("token", state.token);
      toast("Signed in as " + (user.name || user.login));
      state.demo = false;
      renderAccount();
      await go(location.hash || "#/posts", true);
    } catch (e) {
      state.token = "";
      toast(e.message.indexOf("expired") > -1 ? "That key was not accepted. Please try again." : e.message);
    }
  }

  function signOut(quiet) {
    state.token = "";
    state.user = null;
    state.posts = null;
    store.remove("token");
    renderAccount();
    if (!quiet) toast("Signed out.");
    show("signin");
    renderSignin();
  }

  function renderAccount() {
    const el = $("#account");
    if (state.demo) {
      el.innerHTML = '<span class="pill pill--demo">Demo</span> ' +
        '<button class="ghost" type="button" data-action="leave-demo">Sign in</button>';
      return;
    }
    if (!state.user) {
      el.innerHTML = '<button class="ghost" type="button" data-action="go-signin">Sign in</button>';
      return;
    }
    el.innerHTML =
      '<div class="account">' +
        '<img src="' + esc(state.user.avatar_url) + '" alt="" width="26" height="26">' +
        '<span class="account__name">' + esc(state.user.name || state.user.login) + '</span>' +
        '<button class="ghost" type="button" data-action="signout">Sign out</button>' +
      '</div>';
  }

  /* ========================================================================
     Views
     ======================================================================== */
  function show(view) {
    ["signin", "list", "editor"].forEach((v) => { $("#view-" + v).hidden = v !== view; });
    window.scrollTo(0, 0);
  }

  async function go(hash, force) {
    const route = (hash || "").replace(/^#/, "") || "/posts";

    if (route.indexOf("/edit/") === 0) {
      const slug = decodeURIComponent(route.slice(6));
      await openEditor(slug);
      return;
    }
    if (route === "/new") { await openEditor(null); return; }

    show("list");
    if (!state.posts || force) await refreshList();
    else renderList();
  }

  // Signed out, everything can still be read, opened and previewed — the site's
  // posts are public. Signing in is asked for at the one moment it is needed.
  const canPublish = () => !!state.token && !state.demo;

  async function requireSignin(what) {
    const ok = await confirmDialog({
      title: "Sign in to " + what,
      body: "You can read and preview everything without signing in. Putting a change " +
            "on the website needs the campaign's GitHub account.",
      confirm: "Sign in",
    });
    if (ok) { state.demo = false; renderAccount(); show("signin"); renderSignin(); }
  }

  /* ---------------------------------------------------------------- list -- */
  async function refreshList() {
    const body = $("#list-body");
    body.innerHTML = '<div class="rows">' + '<div class="skeleton"></div>'.repeat(3) + "</div>";
    try {
      if (state.demo) state.posts = demoPosts();
      else await loadPosts();
      renderList();
    } catch (e) {
      // A private repository, or a rate limit: signing in fixes both.
      if (!state.token && (e.status === 404 || e.status === 403)) {
        show("signin");
        renderSignin();
        return;
      }
      body.innerHTML = signedOutNotice() + '<div class="empty"><p>' + esc(e.message) + "</p>" +
        (e.status === 404
          ? "<p class=\"muted\">Check the repository name in Help &rsaquo; Settings.</p>"
          : '<p><button class="btn" type="button" data-action="retry">Try again</button></p>') +
        "</div>";
    }
  }

  function signedOutNotice() {
    if (state.token || state.demo) return "";
    return '<div class="notice">You are signed out. Everything here can be read and ' +
      'previewed — <button class="linklike" type="button" data-action="go-signin">sign in</button> ' +
      "when you want to publish a change.</div>";
  }

  function renderList() {
    const posts = (state.posts || []).filter((p) => {
      const hidden = String(p.meta.draft || "").toLowerCase() === "true";
      if (state.filter === "live" && hidden) return false;
      if (state.filter === "hidden" && !hidden) return false;
      if (!state.query) return true;
      return (p.meta.title + " " + p.meta.excerpt + " " + p.body).toLowerCase().indexOf(state.query) > -1;
    });

    const total = (state.posts || []).length;
    const hiddenCount = (state.posts || []).filter((p) => String(p.meta.draft || "").toLowerCase() === "true").length;
    $("#list-count").textContent =
      total + (total === 1 ? " post" : " posts") +
      (hiddenCount ? " · " + hiddenCount + " hidden" : "");

    if (!posts.length) {
      $("#list-body").innerHTML = signedOutNotice() + '<div class="empty"><p>' +
        (state.query ? "Nothing matches “" + esc(state.query) + "”." : "No posts here yet.") +
        "</p></div>";
      return;
    }

    $("#list-body").innerHTML = signedOutNotice() + '<div class="rows">' + posts.map(function (p) {
      const hidden = String(p.meta.draft || "").toLowerCase() === "true";
      const thumb = p.meta.image
        ? '<img class="row__thumb" src="../' + esc(p.meta.image) + '" alt="" loading="lazy">'
        : '<div class="row__thumb row__thumb--none">No photo</div>';
      return (
        '<button class="row" type="button" data-slug="' + esc(p.slug) + '">' +
          thumb +
          "<div>" +
            '<h2 class="row__title">' + esc(p.meta.title || p.slug) + "</h2>" +
            '<div class="row__meta">' +
              '<span class="tag ' + (hidden ? "tag--hidden" : "tag--live") + '">' +
                (hidden ? "Hidden" : "Live") + "</span>" +
              "<span>" + esc(p.meta.category || "News") + "</span>" +
              "<span>" + esc(niceDate(p.meta.date)) + "</span>" +
            "</div>" +
          "</div>" +
          '<span class="row__go">Edit &rsaquo;</span>' +
        "</button>"
      );
    }).join("") + "</div>";
  }

  /* ========================================================================
     Editor
     ======================================================================== */
  async function openEditor(slug) {
    if (!state.posts) {
      try { state.posts = state.demo ? demoPosts() : await loadPosts(); }
      catch (e) { toast(e.message); }
    }

    let post;
    if (slug) {
      post = (state.posts || []).filter((p) => p.slug === slug)[0];
      if (!post) { toast("That post could not be found."); location.hash = "#/posts"; return; }
      state.editing = {
        slug: post.slug,
        path: post.path,
        sha: post.sha,
        isNew: false,
        title: post.meta.title || "",
        excerpt: post.meta.excerpt || "",
        category: post.meta.category || "News",
        date: post.meta.date || today(),
        image: post.meta.image || "",
        imageAlt: post.meta.imageAlt || post.meta.imagealt || "",
        draft: String(post.meta.draft || "").toLowerCase() === "true",
        source: post.meta.source || "",
        body: post.body || "",
      };
    } else {
      state.editing = {
        slug: null, path: null, sha: null, isNew: true,
        title: "", excerpt: "", category: "News", date: today(),
        image: "", imageAlt: "", draft: false, source: "", body: "",
      };
    }

    state.pendingImage = null;
    state.dirty = false;

    fillForm();
    restoreLocalDraft();
    show("editor");
    updatePreview();
    setStatus(state.editing.isNew ? "New post" : (state.editing.draft ? "Hidden from the site" : "Live on the site"));
    $("#danger-zone").hidden = state.editing.isNew;
    $("[data-action='save-hidden']").textContent = state.editing.draft ? "Save as hidden" : "Hide from site";

    // Category suggestions come from the posts that already exist.
    const cats = [];
    (state.posts || []).forEach((p) => {
      if (p.meta.category && cats.indexOf(p.meta.category) === -1) cats.push(p.meta.category);
    });
    $("#categories").innerHTML = cats.map((c) => '<option value="' + esc(c) + '">').join("");
    setTimeout(() => { autogrow($("#f-title")); autogrow($("#f-body")); }, 0);
  }

  function fillForm() {
    const e = state.editing;
    $("#f-title").value = e.title;
    $("#f-excerpt").value = e.excerpt;
    $("#f-category").value = e.category;
    $("#f-date").value = e.date;
    $("#f-alt").value = e.imageAlt;
    $("#f-body").value = e.body;
    renderPhoto();
    renderChecks();
    updateExcerptCount();
  }

  function readForm() {
    const e = state.editing;
    e.title = $("#f-title").value;
    e.excerpt = $("#f-excerpt").value;
    e.category = $("#f-category").value.trim() || "News";
    e.date = $("#f-date").value || today();
    e.imageAlt = $("#f-alt").value;
    e.body = $("#f-body").value;
    return e;
  }

  function setStatus(text, tone) {
    const el = $("#edit-status");
    el.textContent = text;
    el.style.color = tone === "warn" ? "var(--warn)" : "";
  }

  function autogrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, el.classList.contains("input--body") ? 320 : 0) + "px";
  }

  /* ------------------------------------------------------------- photos -- */
  function renderPhoto() {
    const e = state.editing;
    const has = !!(state.pendingImage || e.image);
    $(".dropzone__empty").hidden = has;
    $(".dropzone__filled").hidden = !has;
    $("#alt-field").hidden = !has;
    if (!has) return;

    $("#photo-preview").src = state.pendingImage ? state.pendingImage.dataUrl : "../" + e.image;
    $("#photo-note").textContent = state.pendingImage
      ? state.pendingImage.note
      : "Already on the site";
  }

  /* Campaign photographs come off a phone at ten megapixels. Shrinking them
     here keeps the site fast and the repository small, and means nobody has
     to think about file sizes. */
  function prepareImage(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("That file could not be read."));
      reader.onload = function () {
        const img = new Image();
        img.onerror = () => reject(new Error("That does not look like a photo."));
        img.onload = function () {
          const scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth);
          const small = scale < 1 || file.size > 500 * 1024 || file.type === "image/heic";

          if (!small && /^image\/(jpeg|png|webp)$/.test(file.type)) {
            const base64 = String(reader.result).split(",")[1];
            resolve({
              base64: base64,
              mime: file.type,
              dataUrl: String(reader.result),
              ext: file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg",
              note: img.naturalWidth + " × " + img.naturalHeight,
            });
            return;
          }

          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
          resolve({
            base64: dataUrl.split(",")[1],
            mime: "image/jpeg",
            dataUrl: dataUrl,
            ext: "jpg",
            note: w + " × " + h + " · " + Math.max(1, Math.round(bytes / 1024)) + " KB",
          });
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function acceptPhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("That is not a photo."); return; }
    try {
      setStatus("Getting the photo ready…");
      state.pendingImage = await prepareImage(file);
      state.dirty = true;
      renderPhoto();
      renderChecks();
      updatePreview();
      setStatus("Photo added — not published yet", "warn");
      if (!$("#f-alt").value) $("#f-alt").focus();
    } catch (err) {
      toast(err.message);
      setStatus("");
    }
  }

  /* -------------------------------------------------------------- checks -- */
  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17.5l-5-5 1.6-1.6 3.4 3.4 8.4-8.4L19.5 7.5z"/></svg>';
  const BANG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l10 19H2L12 2zm-1 7v6h2V9h-2zm0 8v2h2v-2h-2z"/></svg>';

  function renderChecks() {
    const e = readForm();
    const titleLen = e.title.trim().length;
    const exLen = e.excerpt.trim().length;
    const bodyLen = e.body.trim().length;
    const hasPhoto = !!(state.pendingImage || e.image);

    const checks = [
      titleLen === 0
        ? [false, "A headline is needed before this can go up."]
        : titleLen > 95
        ? [false, "The headline is long — Google will cut it off around 90 characters."]
        : [true, "Headline reads well at " + titleLen + " characters."],

      exLen === 0
        ? [false, "The one-sentence summary is empty. It is what Facebook and Google show."]
        : exLen < 70
        ? [false, "The summary is short. Around 100–160 characters fills the space Google gives you."]
        : exLen > 175
        ? [false, "The summary is long — it will be cut off at about 160 characters."]
        : [true, "Summary is a good length at " + exLen + " characters."],

      hasPhoto
        ? (e.imageAlt.trim()
            ? [true, "Photo has a caption."]
            : [false, "Add a line about what is happening in the photo — it shows as the caption."])
        : [false, "No photo. A post with a photograph gets read far more often than one without."],

      bodyLen < 120
        ? [false, "The post is very short. Two or three paragraphs is usually the minimum worth publishing."]
        : [true, "Post is " + bodyLen.toLocaleString() + " characters."],
    ];

    if (e.date > today()) {
      checks.push([true, "Dated ahead — it will sit at the top of the news page."]);
    }

    $("#checks").innerHTML = checks.map(function (c) {
      return '<div class="check ' + (c[0] ? "check--ok" : "check--warn") + '">' +
        (c[0] ? TICK : BANG) + "<span>" + esc(c[1]) + "</span></div>";
    }).join("");
  }

  /* ========================================================================
     Preview

     Everything below hands the post to the very code that publishes it.
     ======================================================================== */
  function previewPost() {
    const e = readForm();
    const image = state.pendingImage ? PREVIEW_IMG : e.image;
    return {
      slug: e.slug || MD.slugify(e.title) || "new-post",
      title: e.title.trim() || "Your headline goes here",
      date: e.date,
      category: e.category,
      excerpt: e.excerpt.trim(),
      image: image,
      imageAlt: e.imageAlt.trim(),
      updated: "",
      bodyHTML: MD.markdownToHTML(e.body, "../"),
      plain: MD.stripTags(MD.markdownToHTML(e.body, "../")),
      url: "news/" + (e.slug || MD.slugify(e.title) || "new-post") + ".html",
    };
  }

  // A photo chosen but not yet uploaded has no address on the web, so the
  // placeholder path is swapped for the picture the browser already holds.
  function withPendingPhoto(html) {
    if (!state.pendingImage) return html;
    const token = PREVIEW_IMG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return html.replace(new RegExp('(?:\\.\\./|https?://[^"\']*?/)' + token, "g"), state.pendingImage.dataUrl);
  }

  const FORCE_VISIBLE = "<style>[data-fade]{opacity:1!important;transform:none!important}</style>";

  /* A stylesheet still on its way holds up the whole preview — nothing paints,
     and any script waits behind it. On the campaign's own network that is a few
     milliseconds; on the wifi at an event it is a blank white box. The fonts
     are asked for without blocking, so the preview draws immediately and the
     typefaces arrive when they arrive. Everything that decides the layout is in
     site.css, which is served from the same place as the editor. */
  function nonBlockingFonts(html) {
    return html.replace(
      /<link href="https:\/\/fonts\.googleapis\.com([^"]*)" rel="stylesheet">/,
      '<link href="https://fonts.googleapis.com$1" rel="stylesheet" media="print" onload="this.media=\'all\'">'
    );
  }

  function pagePreviewHTML() {
    const html = PostTemplate.render(previewPost(), {
      siteUrl: config.siteUrl,
      siteName: config.siteName,
      base: "../",
      scripts: false,
    });
    return withPendingPhoto(nonBlockingFonts(html).replace("</head>", FORCE_VISIBLE + "</head>"));
  }

  function cardPreviewHTML() {
    const post = previewPost();
    const doc =
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      // A relative <base> is discarded inside a srcdoc frame, so the site root
      // is worked out here and given absolutely. This keeps the card preview
      // correct even when the site is served from a subfolder.
      '<base href="' + new URL("../", location.href).href + '">' +
      // The webfont link is loaded without blocking: a stylesheet still on its
      // way stops the scripts below from running, and on a hotel wifi at a
      // campaign event that would leave the preview stuck on an empty box.
      '<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=Open+Sans:wght@400;600;700&display=swap"' +
      ' rel="stylesheet" media="print" onload="this.media=\'all\'">' +
      '<link rel="stylesheet" href="assets/css/site.css">' + FORCE_VISIBLE +
      "<style>body{background:#fff;margin:0}.wrap{max-width:760px;margin:0 auto;padding:1.5rem 1rem}</style>" +
      "</head><body><div class=\"wrap\"><div class=\"news-list\" id=\"news-list\"></div></div>" +
      "<script>window.POSTS = [" + JSON.stringify(post) + "];<\/script>" +
      '<script src="assets/js/site.js"><\/script>' +
      "</body></html>";
    return withPendingPhoto(doc);
  }

  function sharePreviewHTML() {
    const post = previewPost();
    const host = config.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = config.siteUrl + "/news/" + post.slug + ".html";
    const image = post.image ? "../" + post.image : "../assets/img/logo.png";
    const summary = post.excerpt || "Add a one-sentence summary — this is the line people see.";

    return (
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" media="print" onload="this.media=\'all\'">' +
      "<style>" +
      "body{font:15px/1.5 'Open Sans',-apple-system,sans-serif;background:#f0f2f5;color:#050505;margin:0;padding:20px}" +
      "h4{font:600 11px/1 'Open Sans',sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#65676b;margin:0 0 8px}" +
      ".fb{background:#fff;border:1px solid #dadde1;border-radius:8px;overflow:hidden;max-width:500px;margin:0 0 26px}" +
      ".fb img{display:block;width:100%;aspect-ratio:1.91/1;object-fit:cover;background:#e4e6eb}" +
      ".fb__text{padding:10px 12px;background:#f2f3f5;border-top:1px solid #dadde1}" +
      ".fb__host{font-size:12px;text-transform:uppercase;color:#65676b;letter-spacing:.02em}" +
      ".fb__title{font-weight:600;font-size:16px;line-height:1.25;margin:3px 0 2px;color:#050505;" +
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".fb__desc{font-size:14px;color:#65676b;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".g{background:#fff;border-radius:8px;padding:16px 18px;max-width:600px;border:1px solid #dadde1}" +
      ".g__crumb{display:flex;align-items:center;gap:8px;margin-bottom:4px}" +
      ".g__dot{width:26px;height:26px;border-radius:50%;background:#f1f3f4;display:grid;place-items:center;overflow:hidden}" +
      ".g__dot img{width:16px;height:auto}" +
      ".g__site{font-size:12px;line-height:1.2;color:#202124}" +
      ".g__url{font-size:12px;color:#4d5156}" +
      ".g__title{color:#1a0dab;font-size:20px;line-height:1.3;margin:2px 0 3px;" +
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".g__desc{color:#4d5156;font-size:14px;line-height:1.58;" +
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".g__date{color:#70757a}" +
      "@media (prefers-color-scheme:dark){body{background:#16161f}.fb,.g{background:#242433;border-color:#33334a}" +
      ".fb__text{background:#2b2b3d;border-color:#33334a}.fb__title{color:#eceff4}.g__title{color:#8ab4f8}" +
      ".g__site,.g__desc,.g__url,.fb__desc,.fb__host{color:#9aa0a6}h4{color:#9aa0a6}}" +
      "</style></head><body>" +

      "<h4>Facebook, LinkedIn and text messages</h4>" +
      '<div class="fb">' +
        '<img src="' + esc(image) + '" alt="">' +
        '<div class="fb__text">' +
          '<div class="fb__host">' + esc(host) + "</div>" +
          '<div class="fb__title">' + esc(post.title) + "</div>" +
          '<div class="fb__desc">' + esc(summary) + "</div>" +
        "</div>" +
      "</div>" +

      "<h4>Google search result</h4>" +
      '<div class="g">' +
        '<div class="g__crumb">' +
          '<div class="g__dot"><img src="../assets/img/mark.png" alt=""></div>' +
          "<div>" +
            '<div class="g__site">' + esc(config.siteName) + "</div>" +
            '<div class="g__url">' + esc(url.replace(/^https?:\/\//, "").replace(/\.html$/, "")) + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="g__title">' + esc(post.title) + "</div>" +
        '<div class="g__desc"><span class="g__date">' + esc(niceDate(post.date)) + "</span> — " + esc(summary) + "</div>" +
      "</div>" +

      "</body></html>"
    );
  }

  const NOTES = {
    page: "This is the page itself — the same template that publishes it.",
    card: "How the post appears on the news page and the home page.",
    share: "What Facebook, a text message and Google show when the link is shared.",
  };

  const updatePreview = debounce(function () {
    const frame = $("#preview-frame");
    const scroll = (function () {
      try { return frame.contentWindow.scrollY; } catch (e) { return 0; }
    })();

    const html = state.previewTab === "card" ? cardPreviewHTML()
      : state.previewTab === "share" ? sharePreviewHTML()
      : pagePreviewHTML();

    frame.srcdoc = html;
    frame.onload = function () {
      try { frame.contentWindow.scrollTo(0, scroll); } catch (e) {}
    };

    $("#stage").dataset.size = state.previewSize;
    $("#stage-note").textContent = NOTES[state.previewTab];
    $("#size-toggle").hidden = state.previewTab === "share";
  }, 180);

  /* ========================================================================
     Local autosave — nothing typed is ever lost to a closed tab
     ======================================================================== */
  const draftKey = () => "draft." + (state.editing && state.editing.slug ? state.editing.slug : "new");

  const saveLocal = debounce(function () {
    if (!state.editing || state.demo) return;
    const e = readForm();
    store.set(draftKey(), {
      title: e.title, excerpt: e.excerpt, category: e.category, date: e.date,
      imageAlt: e.imageAlt, body: e.body, at: Date.now(),
    });
  }, 500);

  function restoreLocalDraft() {
    const saved = store.get(draftKey(), null);
    if (!saved) return;
    const e = state.editing;
    const same = saved.title === e.title && saved.excerpt === e.excerpt && saved.body === e.body;
    if (same) { store.remove(draftKey()); return; }

    setStatus("Unsaved changes from " + timeAgo(saved.at) + " restored", "warn");
    e.title = saved.title; e.excerpt = saved.excerpt; e.category = saved.category;
    e.date = saved.date; e.imageAlt = saved.imageAlt; e.body = saved.body;
    state.dirty = true;
    fillForm();
  }

  function timeAgo(ts) {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "a moment ago";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    const days = Math.round(hrs / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  }

  /* ========================================================================
     Publishing
     ======================================================================== */
  function uniqueSlug(base) {
    const taken = (state.posts || []).map((p) => p.slug);
    if (taken.indexOf(base) === -1) return base;
    let n = 2;
    while (taken.indexOf(base + "-" + n) > -1) n++;
    return base + "-" + n;
  }

  async function publish(options) {
    const opts = options || {};
    const e = readForm();

    if (!e.title.trim()) { toast("Add a headline first."); $("#f-title").focus(); return; }
    if (!e.excerpt.trim()) { toast("Add the one-sentence summary first."); $("#f-excerpt").focus(); return; }
    if (!e.body.trim()) { toast("The post has no text yet."); $("#f-body").focus(); return; }

    if (state.demo) {
      toast("This is the demo — sign in to publish for real.");
      return;
    }
    if (!canPublish()) { await requireSignin("publish this"); return; }

    if (opts.hidden !== undefined) e.draft = opts.hidden;

    const slug = e.isNew ? uniqueSlug(MD.slugify(e.title)) : e.slug;
    const path = NEWS_DIR + "/" + slug + ".md";

    // Someone else may have touched this post since it was opened.
    if (!e.isNew) {
      const now = await currentSha(e.path);
      if (now && e.sha && now !== e.sha) {
        const proceed = await confirmDialog({
          title: "This post changed while you had it open",
          body: "Someone else saved a change to this post. Publishing now replaces " +
                "their version with yours. Nothing is lost either way — every version " +
                "is kept on GitHub — but it is worth a look first.",
          confirm: "Publish mine anyway",
        });
        if (!proceed) return;
      }
    }

    const files = [];
    let image = e.image;

    if (state.pendingImage) {
      image = IMG_DIR + "/" + slug + "." + state.pendingImage.ext;
      files.push({ path: image, content: state.pendingImage.base64, encoding: "base64" });
    }

    const meta = {
      title: e.title.trim(),
      date: e.date,
      category: e.category,
      excerpt: e.excerpt.trim(),
      image: image,
      imageAlt: e.imageAlt.trim(),
      source: e.source,
      draft: e.draft,
      // An edit to a published post records when it changed, which is what
      // Google reads to know the story was updated rather than reposted.
      updated: e.isNew ? "" : today() !== e.date ? today() : "",
    };

    files.push({ path: path, content: MD.renderPostFile(meta, e.body) });

    const verb = e.isNew ? "Add" : "Update";
    const who = state.user ? " (" + (state.user.name || state.user.login) + ")" : "";

    try {
      busy(e.draft ? "Saving…" : "Publishing…");
      await commitFiles(files, verb + " post: " + meta.title + who);

      // Success: the file is committed. Everything after this is reporting.
      store.remove(draftKey());
      state.dirty = false;
      state.pendingImage = null;
      state.posts = null;

      Object.assign(state.editing, { slug: slug, path: path, isNew: false, image: image, draft: e.draft });
      $("#danger-zone").hidden = false;
      history.replaceState(null, "", "#/edit/" + encodeURIComponent(slug));

      if (e.draft) {
        busyDone("Saved, and hidden from the site.");
        setStatus("Hidden from the site");
        $("[data-action='save-hidden']").textContent = "Save as hidden";
        return;
      }

      busy("Building the page…");
      const ok = await waitForBuild((s) => busy(s));
      // The link is built from where the editor is being served, which is by
      // definition a live address, rather than from the canonical domain, which
      // may not be pointed at the site yet.
      const liveRoot = /^https?:/.test(location.origin) ? location.origin : config.siteUrl;
      const link = liveRoot + "/news/" + slug + ".html";
      if (ok === false) {
        busyDone("Saved, but the site did not rebuild. Ask your developer to check the Actions tab.");
      } else if (ok === null) {
        busyDone("Published. It appears on the site within a minute or two.");
      } else {
        busyDone('It is live. <a href="' + esc(link) + '" target="_blank" rel="noopener">View the post</a>');
      }
      setStatus("Live on the site");
      $("[data-action='save-hidden']").textContent = "Hide from site";
      state.editing.sha = await currentSha(path);
    } catch (err) {
      busyDone("Could not publish: " + err.message);
      setStatus("Not published", "warn");
    }
  }

  async function removePost() {
    const e = state.editing;
    if (state.demo) { toast("This is the demo — nothing is really deleted."); return; }
    if (!canPublish()) { await requireSignin("delete a post"); return; }

    const ok = await confirmDialog({
      title: "Delete “" + (e.title || e.slug) + "”?",
      body: "It comes off the news page, the feed and the sitemap within a minute or " +
            "two. Google drops it over the following few days. If you only want it gone " +
            "for a while, close this and use Hide from site instead.",
      confirm: "Delete the post",
      danger: true,
    });
    if (!ok) return;

    try {
      busy("Deleting…");
      await commitFiles([{ path: e.path, remove: true }], "Delete post: " + (e.title || e.slug));
      store.remove(draftKey());
      state.posts = null;
      state.dirty = false;
      busyDone("Deleted.");
      location.hash = "#/posts";
    } catch (err) {
      busyDone("Could not delete: " + err.message);
    }
  }

  /* ========================================================================
     Toast, modal, help
     ======================================================================== */
  let toastTimer;
  function toast(message, sticky) {
    const el = $("#toast");
    el.innerHTML = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }
  function busy(message) {
    toast('<span class="spinner"></span>' + esc(message), true);
  }
  function busyDone(message) {
    toast(message);
  }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      const modal = $("#modal");
      $("#modal-body").innerHTML =
        "<h2>" + esc(o.title) + "</h2>" +
        "<p>" + esc(o.body) + "</p>" +
        '<div class="modal__actions">' +
          '<button class="btn" type="button" data-modal="cancel">Cancel</button>' +
          '<button class="btn ' + (o.danger ? "btn--danger" : "btn--primary") + '" type="button" data-modal="ok">' +
            esc(o.confirm) + "</button>" +
        "</div>";
      modal.showModal();
      modal.onclick = function (ev) {
        const btn = ev.target.closest("[data-modal]");
        if (!btn) return;
        modal.close();
        resolve(btn.dataset.modal === "ok");
      };
      modal.oncancel = function () { resolve(false); };
    });
  }

  function openHelp() {
    const modal = $("#modal");
    $("#modal-body").innerHTML =
      '<div class="help">' +
      "<h2>How this works</h2>" +
      "<dl>" +
        "<dt>Where does what I write go?</dt>" +
        "<dd>Press Publish and the post is saved to the campaign's GitHub repository. " +
        "The website rebuilds itself and the post is live about a minute later — " +
        "on the news page, the home page, the RSS feed and the sitemap.</dd>" +

        "<dt>Can I break something?</dt>" +
        "<dd>No. Every version of every post is kept, so anything can be undone. " +
        "Nothing is public until you press Publish.</dd>" +

        "<dt>Write now, publish later</dt>" +
        "<dd>Use <strong>Save as hidden</strong>. The post is saved but stays off the " +
        "website until you open it again and press Publish.</dd>" +

        "<dt>Shortcuts</dt>" +
        "<dd><kbd>Ctrl</kbd>+<kbd>S</kbd> keep a copy on this computer · " +
        "<kbd>Ctrl</kbd>+<kbd>B</kbd> bold · <kbd>Ctrl</kbd>+<kbd>I</kbd> italic · " +
        "<kbd>Ctrl</kbd>+<kbd>K</kbd> link</dd>" +

        "<dt>Settings</dt>" +
        "<dd>Editing <strong>" + esc(REPO()) + "</strong> on the <strong>" + esc(config.branch) +
        "</strong> branch, publishing to <strong>" + esc(config.siteUrl) + "</strong>." +
        '<div class="keyrow"><input class="input" id="cfg-repo" value="' + esc(REPO()) +
        '" aria-label="Repository"><input class="input" id="cfg-site" value="' + esc(config.siteUrl) +
        '" aria-label="Website address"></div>' +
        '<div class="modal__actions"><button class="btn" type="button" data-action="save-config">Save settings</button></div>' +
        "</dd>" +
      "</dl>" +
      '<div class="modal__actions"><button class="btn btn--primary" type="button" data-modal="ok">Close</button></div>' +
      "</div>";
    modal.showModal();
    modal.onclick = function (ev) {
      if (ev.target.closest("[data-modal]")) modal.close();
      if (ev.target.closest("[data-action='save-config']")) {
        const repo = $("#cfg-repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
        const parts = repo.split("/");
        if (parts.length === 2) { config.owner = parts[0]; config.repo = parts[1]; }
        config.siteUrl = $("#cfg-site").value.trim().replace(/\/$/, "") || config.siteUrl;
        store.set("config", { owner: config.owner, repo: config.repo, branch: config.branch, siteUrl: config.siteUrl, siteName: config.siteName });
        modal.close();
        state.posts = null;
        toast("Settings saved.");
        go("#/posts", true);
      }
    };
  }

  /* ========================================================================
     Formatting toolbar
     ======================================================================== */
  function applyFormat(kind) {
    const ta = $("#f-body");
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    let before = "", after = "", text = selected, caret = null;

    if (kind === "bold") { before = "**"; after = "**"; text = selected || "important"; }
    else if (kind === "italic") { before = "*"; after = "*"; text = selected || "emphasis"; }
    else if (kind === "link") {
      const url = prompt("Address to link to (or a page like contact.html):", "https://");
      if (!url) return;
      before = "["; after = "](" + url + ")"; text = selected || "link text";
    } else {
      // Line-level formats work on whole lines.
      const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
      const mark = kind === "h2" ? "## " : kind === "bullet" ? "- " : "> ";
      const block = ta.value.slice(lineStart, end) || (kind === "bullet" ? "First point" : "Text");
      const marked = block.split("\n").map((l) => (l.indexOf(mark) === 0 ? l : mark + l)).join("\n");
      ta.setRangeText(marked, lineStart, Math.max(end, lineStart), "end");
      onInput();
      ta.focus();
      return;
    }

    ta.setRangeText(before + text + after, start, end, "end");
    if (caret === null && !selected) {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + text.length;
    }
    onInput();
    ta.focus();
  }

  /* ========================================================================
     Demo content — so the editor can be shown to someone before setup
     ======================================================================== */
  function demoPosts() {
    return [{
      slug: "town-hall-in-helena",
      path: NEWS_DIR + "/town-hall-in-helena.md",
      sha: "demo",
      meta: {
        title: "Hulsey to Host Town Hall in Helena",
        date: today(),
        category: "Events",
        excerpt: "Rep. Hulsey will hold an open town hall at Helena City Hall, with no agenda beyond what residents bring.",
      },
      body: "Rep. Leigh Hulsey will host an open town hall for House District 15 residents " +
        "later this month. There is no agenda and no sign-up — anyone who lives in the " +
        "district is welcome to come and ask about anything.\n\n" +
        "When: Saturday, September 27, 10:00 a.m. to noon\n" +
        "Where: Helena City Hall, 816 Highway 52 East\n\n" +
        "## What will be covered\n\n" +
        "- Where the FOCUS Act stands now that it is law\n" +
        "- Grant funding coming into the district\n" +
        "- Anything else residents raise\n\n" +
        "> \"The best ideas I take to Montgomery come from conversations like this one.\"\n\n" +
        "Questions ahead of time can go to the campaign through the " +
        "[contact page](contact.html).",
    }];
  }

  /* ========================================================================
     Wiring
     ======================================================================== */
  function onInput() {
    state.dirty = true;
    renderChecks();
    updatePreview();
    saveLocal();
    if (state.editing && !state.editing.isNew) setStatus("Unsaved changes — press Publish to put them on the site", "warn");
  }

  function wire() {
    // Top-level clicks
    document.addEventListener("click", async function (ev) {
      const el = ev.target.closest("[data-action]");
      if (el) {
        const action = el.dataset.action;
        if (action === "help") openHelp();
        if (action === "signin") signIn($("#token-input").value);
        if (action === "go-signin" || action === "leave-demo") {
          state.demo = false; state.posts = null; renderAccount(); show("signin"); renderSignin();
        }
        if (action === "signout") signOut();
        if (action === "demo") {
          state.demo = true;
          state.posts = demoPosts();
          renderAccount();
          location.hash = "#/posts";
          show("list");
          renderList();
          toast("Demo mode — publishing is switched off.");
        }
        if (action === "new") location.hash = "#/new";
        if (action === "retry") refreshList();
        if (action === "back") {
          if (state.dirty && !await confirmDialog({
            title: "Leave without publishing?",
            body: "Your changes are kept on this computer and will be here when you come back, " +
                  "but they are not on the website yet.",
            confirm: "Leave",
          })) return;
          state.dirty = false;
          location.hash = "#/posts";
        }
        if (action === "publish") publish({ hidden: false });
        if (action === "save-hidden") publish({ hidden: true });
        if (action === "delete") removePost();
        if (action === "replace-photo") { ev.stopPropagation(); $("#photo-input").click(); }
        if (action === "remove-photo") {
          ev.stopPropagation();
          state.pendingImage = null;
          state.editing.image = "";
          state.dirty = true;
          renderPhoto(); renderChecks(); updatePreview();
        }
      }

      const row = ev.target.closest(".row");
      if (row) location.hash = "#/edit/" + encodeURIComponent(row.dataset.slug);

      const filter = ev.target.closest("[data-filter]");
      if (filter) {
        $$("#list-filters button").forEach((b) => b.classList.remove("is-active"));
        filter.classList.add("is-active");
        state.filter = filter.dataset.filter;
        renderList();
      }

      const tab = ev.target.closest("[data-preview]");
      if (tab) {
        $$("[data-preview]").forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        state.previewTab = tab.dataset.preview;
        updatePreview();
      }

      const size = ev.target.closest("[data-size]");
      if (size) {
        $$("[data-size]").forEach((b) => b.classList.remove("is-active"));
        size.classList.add("is-active");
        state.previewSize = size.dataset.size;
        updatePreview();
      }

      const pane = ev.target.closest("[data-pane]");
      if (pane) {
        $$("[data-pane]").forEach((b) => b.classList.remove("is-active"));
        pane.classList.add("is-active");
        $("#panes").dataset.showing = pane.dataset.pane;
      }

      const md = ev.target.closest("[data-md]");
      if (md) { ev.preventDefault(); applyFormat(md.dataset.md); }
    });

    // Typing
    ["f-title", "f-excerpt", "f-category", "f-date", "f-alt", "f-body"].forEach(function (id) {
      const el = $("#" + id);
      el.addEventListener("input", function () {
        if (id === "f-title" || id === "f-body") autogrow(el);
        if (id === "f-excerpt") updateExcerptCount();
        onInput();
      });
    });

    $("#list-search").addEventListener("input", function () {
      state.query = this.value.trim().toLowerCase();
      renderList();
    });

    // Photo: click, drop, paste
    const zone = $("#dropzone");
    zone.addEventListener("click", () => $("#photo-input").click());
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#photo-input").click(); }
    });
    ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => {
      e.preventDefault(); zone.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, (e) => {
      e.preventDefault(); zone.classList.remove("is-over");
    }));
    zone.addEventListener("drop", (e) => acceptPhoto(e.dataTransfer.files[0]));
    $("#photo-input").addEventListener("change", function () { acceptPhoto(this.files[0]); this.value = ""; });
    document.addEventListener("paste", function (e) {
      if ($("#view-editor").hidden) return;
      const item = Array.prototype.slice.call(e.clipboardData.items).filter((i) => i.type.indexOf("image/") === 0)[0];
      if (item) acceptPhoto(item.getAsFile());
    });

    // Keyboard
    document.addEventListener("keydown", function (e) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const inBody = document.activeElement === $("#f-body");
      if (e.key === "s") {
        e.preventDefault();
        saveLocal();
        toast("Kept on this computer. Press Publish to put it on the website.");
      }
      if (inBody && (e.key === "b" || e.key === "i" || e.key === "k")) {
        e.preventDefault();
        applyFormat(e.key === "b" ? "bold" : e.key === "i" ? "italic" : "link");
      }
    });

    window.addEventListener("hashchange", () => go(location.hash));
    window.addEventListener("beforeunload", function (e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  function updateExcerptCount() {
    const n = $("#f-excerpt").value.trim().length;
    const el = $("#excerpt-count");
    el.textContent = n + " / 160";
    el.className = "counter " + (n >= 70 && n <= 175 ? "counter--good" : n ? "counter--warn" : "");
  }

  /* ========================================================================
     Start
     ======================================================================== */
  async function boot() {
    $$("[data-site-host]").forEach((el) => {
      el.textContent = config.siteUrl.replace(/^https?:\/\//, "");
    });

    // A token handed back by the optional sign-in helper arrives in the URL
    // fragment, which browsers never send to a server. Take it and tidy up.
    const fromOAuth = (location.hash.match(/token=([^&]+)/) || [])[1];
    if (fromOAuth) {
      history.replaceState(null, "", location.pathname);
      await signIn(decodeURIComponent(fromOAuth));
    }

    state.oauth = await probeOAuth();
    wire();
    updateExcerptCount();

    if (state.token && !state.user) {
      try { state.user = await gh("/user"); } catch (e) { state.token = ""; store.remove("token"); }
    }
    renderAccount();
    renderSignin();
    await go(location.hash);
  }

  boot();
})();
