/* ==========================================================================
   Hulsey for House — site.js
   Vanilla JS. No dependencies. Everything degrades gracefully without it.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. CONFIG — edit these, everything else follows.
   -------------------------------------------------------------------------- */
window.SITE = {
  // Paste the live WinRed (or ActBlue) page here. Amounts get appended as
  // ?amount=50 and ?frequency=monthly, which WinRed accepts.
  donateUrl: "https://secure.winred.com/hulsey-for-house/donate",

  // Where contact + volunteer + email signups go.
  // Easiest option with no backend: create a free form endpoint (Formspree,
  // Netlify Forms, Google Form) and paste the URL here. Leave it empty and the
  // forms fall back to opening the visitor's email client instead.
  formEndpoint: "",

  email: "info@hulseyforhouse.com",
  phone: "",
  mailingAddress: "Hulsey for House · Helena, AL 35080",

  social: {
    facebook: "https://www.facebook.com/",
    instagram: "https://www.instagram.com/",
    x: "",
  },

  // Legally required on political material. Update to match what the campaign
  // files with the Alabama Secretary of State.
  disclaimer: "Paid for by Hulsey for House.",
};

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------------
     2. Header: sticky shadow + scroll progress
     ------------------------------------------------------------------------ */
  function header() {
    var head = $(".header");
    var bar = $(".progress__bar");
    var top = $(".to-top");
    if (!head && !bar && !top) return;

    var ticking = false;
    function update() {
      var y = window.scrollY || window.pageYOffset;
      if (head) head.classList.toggle("is-stuck", y > 12);
      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + "%";
      }
      if (top) top.classList.toggle("is-visible", y > 600);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();

    if (top) {
      top.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }
  }

  /* ------------------------------------------------------------------------
     3. Mobile drawer
     ------------------------------------------------------------------------ */
  function drawer() {
    var burger = $(".burger");
    var panel = $(".drawer");
    if (!burger || !panel) return;

    var links = $$(".drawer__link", panel);
    links.forEach(function (l, i) { l.style.animationDelay = 60 + i * 55 + "ms"; });

    function setOpen(open) {
      burger.setAttribute("aria-expanded", String(open));
      panel.classList.toggle("is-open", open);
      document.body.classList.toggle("is-locked", open);
      panel.setAttribute("aria-hidden", String(!open));
      if (open) {
        // restart the stagger
        links.forEach(function (l) { l.style.animation = "none"; void l.offsetWidth; l.style.animation = ""; });
      }
    }

    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) { setOpen(false); burger.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 992 && panel.classList.contains("is-open")) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------------
     4. Scroll reveal
     ------------------------------------------------------------------------ */
  function reveal() {
    var els = $$("[data-reveal]");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute("data-delay") || "0", 10);
        setTimeout(function () { el.classList.add("is-in"); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------------
     5. Counting stats
     ------------------------------------------------------------------------ */
  function counters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduceMotion) { el.textContent = prefix + target.toLocaleString() + suffix; return; }
      var dur = 1400, start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString() + suffix;
        if (p < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) { nums.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------------------------------
     6. Hero headline rotator
     ------------------------------------------------------------------------ */
  function rotator() {
    var el = $("[data-rotate]");
    if (!el) return;
    var words = (el.getAttribute("data-rotate") || "").split("|").map(function (w) { return w.trim(); }).filter(Boolean);
    if (words.length < 2) return;

    if (reduceMotion) { el.textContent = words[0]; return; }

    var i = 0;
    el.innerHTML = '<span class="rot-word">' + words[0] + "</span>";

    setInterval(function () {
      var current = el.firstElementChild;
      if (!current) return;
      current.classList.add("is-out");
      window.setTimeout(function () {
        i = (i + 1) % words.length;
        el.innerHTML = '<span class="rot-word">' + words[i] + "</span>";
      }, 340);
    }, 2600);
  }

  /* ------------------------------------------------------------------------
     7. Issue cards (expand / collapse)
     ------------------------------------------------------------------------ */
  function issues() {
    $$(".issue").forEach(function (card) {
      var btn = $(".issue__toggle", card);
      var more = $(".issue__more", card);
      if (!btn || !more) return;

      var id = more.id || "issue-more-" + Math.random().toString(36).slice(2, 8);
      more.id = id;
      btn.setAttribute("aria-controls", id);
      btn.setAttribute("aria-expanded", "false");

      function toggle() {
        var open = !card.classList.contains("is-open");
        card.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
        $(".issue__toggle-label", btn).textContent = open ? "Less" : "Read more";
      }

      btn.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
      card.addEventListener("click", function (e) {
        if (e.target.closest("a") || e.target.closest(".issue__toggle")) return;
        toggle();
      });
    });
  }

  /* ------------------------------------------------------------------------
     8. Quote rotator
     ------------------------------------------------------------------------ */
  function quotes() {
    var root = $(".quotes");
    if (!root) return;
    var slides = $$(".quote-slide", root);
    var dots = $$(".quotes__dot", root);
    if (slides.length < 2) return;

    var idx = 0, timer = null;

    function show(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === idx); });
      dots.forEach(function (d, i) {
        d.classList.toggle("is-active", i === idx);
        d.setAttribute("aria-selected", String(i === idx));
      });
    }
    function start() { if (!reduceMotion) timer = setInterval(function () { show(idx + 1); }, 6500); }
    function stop() { clearInterval(timer); }

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { stop(); show(i); start(); });
    });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);

    show(0);
    start();
  }

  /* ------------------------------------------------------------------------
     9. News listing (search + category filter)
     ------------------------------------------------------------------------ */
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function fmtDate(iso) {
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return MONTHS[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10) + ", " + p[0];
  }
  function readingTime(html) {
    var words = String(html).replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200)) + " min read";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sorted() {
    return (window.POSTS || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function cardHTML(p) {
    return (
      '<a class="post-card" href="news-post.html?p=' + encodeURIComponent(p.slug) + '">' +
        '<div class="post-card__banner"><span>' + esc(p.title) + "</span></div>" +
        '<div class="post-card__body">' +
          '<div class="post-card__meta">' +
            '<span class="post-card__tag">' + esc(p.category) + "</span>" +
            "<span>&middot;</span><span>" + fmtDate(p.date) + "</span>" +
          "</div>" +
          '<h3 class="post-card__title">' + esc(p.title) + "</h3>" +
          '<p class="post-card__excerpt">' + esc(p.excerpt) + "</p>" +
          '<span class="post-card__more">Read <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5l7 7-7 7v-4H4v-6h9V5z"/></svg></span>' +
        "</div>" +
      "</a>"
    );
  }

  function newsList() {
    var grid = $("#posts-grid");
    if (!grid) return;

    var all = sorted();
    var chipWrap = $("#post-filters");
    var searchInput = $("#post-search");
    var state = { cat: "All", q: "" };

    if (chipWrap) {
      var cats = ["All"];
      all.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
      chipWrap.innerHTML = cats.map(function (c, i) {
        return '<button type="button" class="chip' + (i === 0 ? " is-active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("");
      chipWrap.addEventListener("click", function (e) {
        var b = e.target.closest(".chip");
        if (!b) return;
        $$(".chip", chipWrap).forEach(function (c) { c.classList.remove("is-active"); });
        b.classList.add("is-active");
        state.cat = b.getAttribute("data-cat");
        render();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.q = this.value.trim().toLowerCase();
        render();
      });
    }

    function render() {
      var list = all.filter(function (p) {
        var okCat = state.cat === "All" || p.category === state.cat;
        var hay = (p.title + " " + p.excerpt + " " + p.category + " " + p.body).toLowerCase();
        return okCat && (!state.q || hay.indexOf(state.q) !== -1);
      });
      grid.innerHTML = list.length
        ? list.map(cardHTML).join("")
        : "";
      var empty = $("#posts-empty");
      if (empty) empty.style.display = list.length ? "none" : "block";
      var count = $("#posts-count");
      if (count) count.textContent = list.length + (list.length === 1 ? " post" : " posts");
    }

    render();
  }

  /* Latest 3 on the homepage */
  function newsPreview() {
    var grid = $("#posts-preview");
    if (!grid) return;
    grid.innerHTML = sorted().slice(0, 3).map(cardHTML).join("");
  }

  /* ------------------------------------------------------------------------
     10. Single post page
     ------------------------------------------------------------------------ */
  function postPage() {
    var root = $("#post-root");
    if (!root) return;

    var slug = new URLSearchParams(window.location.search).get("p");
    var all = sorted();
    var i = all.findIndex(function (p) { return p.slug === slug; });

    if (i === -1) {
      root.innerHTML =
        '<div class="wrap-narrow section text-center">' +
        '<h1 class="display" style="font-size:clamp(2rem,6vw,3rem)">Post not found</h1>' +
        '<p class="lede">That link may be out of date.</p>' +
        '<p><a class="btn btn--navy" href="news.html">All news</a></p></div>';
      return;
    }

    var p = all[i];
    var prev = all[i + 1];
    var next = all[i - 1];
    document.title = p.title + " · Hulsey for House";
    var desc = $('meta[name="description"]');
    if (desc) desc.setAttribute("content", p.excerpt);

    var nav = "";
    if (prev || next) {
      nav = '<nav class="article-nav">' +
        (prev ? '<a href="news-post.html?p=' + encodeURIComponent(prev.slug) + '"><small>Previous</small><strong>' + esc(prev.title) + "</strong></a>" : "<span></span>") +
        (next ? '<a class="next" href="news-post.html?p=' + encodeURIComponent(next.slug) + '"><small>Next</small><strong>' + esc(next.title) + "</strong></a>" : "") +
        "</nav>";
    }

    root.innerHTML =
      '<header class="article-hero"><div class="wrap-narrow">' +
        '<div class="article-hero__meta">' +
          '<span class="tag">' + esc(p.category) + "</span><span>&middot;</span>" +
          "<span>" + fmtDate(p.date) + "</span><span>&middot;</span><span>" + readingTime(p.body) + "</span>" +
        "</div>" +
        "<h1>" + esc(p.title) + "</h1>" +
      "</div></header>" +
      '<div class="section"><div class="wrap-narrow">' +
        '<div class="article-body">' + p.body + "</div>" +
        '<div class="share"><span>Share</span>' +
          '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href) + '" target="_blank" rel="noopener" aria-label="Share on Facebook"><svg viewBox="0 0 24 24"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg></a>' +
          '<a href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(location.href) + "&text=" + encodeURIComponent(p.title) + '" target="_blank" rel="noopener" aria-label="Share on X"><svg viewBox="0 0 24 24"><path d="M17.5 3h3l-6.5 7.4L21.7 21h-5.9l-4.6-6-5.3 6H3l7-7.9L2.6 3h6l4.2 5.5L17.5 3z"/></svg></a>' +
          '<button type="button" data-copy aria-label="Copy link"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.5.5l3-3A5 5 0 0013.5 3.5l-1.7 1.7"/><path d="M14 11a5 5 0 00-7.5-.5l-3 3A5 5 0 0010.5 20.5l1.7-1.7" /></svg></button>' +
        "</div>" +
        nav +
        '<p style="margin-top:2.5rem"><a class="textlink" href="news.html">&larr; All news</a></p>' +
      "</div></div>";

    // fix the copy icon (stroke-based path needs stroke styling)
    $$("[data-copy] svg path").forEach(function (path) {
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
    });
    var copyBtn = $("[data-copy]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var done = function () {
          copyBtn.setAttribute("aria-label", "Link copied");
          copyBtn.style.background = "var(--red)";
          copyBtn.style.borderColor = "var(--red)";
          $("svg", copyBtn).style.stroke = "#fff";
          setTimeout(function () {
            copyBtn.style.background = "";
            copyBtn.style.borderColor = "";
            $("svg", copyBtn).style.stroke = "";
            copyBtn.setAttribute("aria-label", "Copy link");
          }, 1800);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () {});
      });
    }

    reveal();
  }

  /* ------------------------------------------------------------------------
     11. Donate widget
     ------------------------------------------------------------------------ */
  function donate() {
    var root = $("#donate-widget");
    if (!root) return;

    var amounts = $$(".amount", root);
    var custom = $("#donate-custom", root);
    var freqBtns = $$(".freq button", root);
    var go = $("#donate-go", root);
    var state = { amount: amounts.length ? amounts[1].getAttribute("data-amount") : "50", freq: "once" };

    function sync() {
      amounts.forEach(function (b) {
        var on = b.getAttribute("data-amount") === String(state.amount);
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      var url = window.SITE.donateUrl;
      var join = url.indexOf("?") === -1 ? "?" : "&";
      var q = "amount=" + encodeURIComponent(state.amount);
      if (state.freq === "monthly") q += "&frequency=monthly";
      if (go) {
        go.href = url + join + q;
        go.textContent = state.freq === "monthly"
          ? "Give $" + state.amount + " monthly"
          : "Give $" + state.amount;
      }
    }

    amounts.forEach(function (b) {
      b.addEventListener("click", function () {
        state.amount = b.getAttribute("data-amount");
        if (custom) custom.value = "";
        sync();
      });
    });

    if (custom) {
      custom.addEventListener("input", function () {
        var v = this.value.replace(/[^0-9.]/g, "");
        this.value = v;
        if (v && parseFloat(v) > 0) { state.amount = v; }
        sync();
      });
    }

    freqBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        freqBtns.forEach(function (x) { x.classList.remove("is-active"); x.setAttribute("aria-pressed", "false"); });
        b.classList.add("is-active");
        b.setAttribute("aria-pressed", "true");
        state.freq = b.getAttribute("data-freq");
        sync();
      });
    });

    sync();
  }

  /* Any plain "Donate" link picks up the configured URL */
  function donateLinks() {
    $$("[data-donate]").forEach(function (a) { a.href = window.SITE.donateUrl; });
  }

  /* ------------------------------------------------------------------------
     12. Forms — validate, then POST to formEndpoint (or fall back to mailto)
     ------------------------------------------------------------------------ */
  function forms() {
    $$("form[data-form]").forEach(function (form) {
      var success = $("#" + form.getAttribute("data-success"));

      function fieldError(input, msg) {
        var field = input.closest(".field");
        if (!field) return;
        field.classList.toggle("has-error", !!msg);
        var box = $(".field__error", field);
        if (box) box.textContent = msg || "";
        input.setAttribute("aria-invalid", msg ? "true" : "false");
      }

      function validate(input) {
        var v = (input.value || "").trim();
        if (input.required && !v) { fieldError(input, "This one's required."); return false; }
        if (input.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
          fieldError(input, "Check that email address."); return false;
        }
        fieldError(input, "");
        return true;
      }

      $$("input, textarea", form).forEach(function (input) {
        input.addEventListener("blur", function () { if (input.type !== "checkbox") validate(input); });
        input.addEventListener("input", function () {
          if (input.closest(".field") && input.closest(".field").classList.contains("has-error")) validate(input);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var inputs = $$("input, textarea", form).filter(function (i) { return i.type !== "checkbox" && i.type !== "hidden"; });
        var ok = true;
        inputs.forEach(function (i) { if (!validate(i)) ok = false; });
        if (!ok) {
          var bad = $(".has-error input, .has-error textarea", form);
          if (bad) bad.focus();
          return;
        }

        var btn = $('button[type="submit"]', form);
        var label = btn ? btn.textContent : "";
        if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

        function finish() {
          form.reset();
          if (btn) { btn.disabled = false; btn.textContent = label; }
          if (success) {
            form.hidden = true;
            success.classList.add("is-visible");
            success.setAttribute("tabindex", "-1");
            success.focus();
          }
        }

        var endpoint = window.SITE.formEndpoint;
        if (endpoint) {
          fetch(endpoint, {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form),
          }).then(finish).catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = label; }
            alert("Something went wrong sending that. Please email " + window.SITE.email + " instead.");
          });
        } else {
          // No backend configured yet — hand it to the visitor's mail client.
          var data = new FormData(form);
          var lines = [];
          data.forEach(function (val, key) { if (val) lines.push(key + ": " + val); });
          var subject = form.getAttribute("data-subject") || "Website message";
          window.location.href =
            "mailto:" + window.SITE.email +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(lines.join("\n"));
          setTimeout(finish, 400);
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     13. Config-driven bits of chrome
     ------------------------------------------------------------------------ */
  function chrome() {
    $$("[data-site-email]").forEach(function (el) {
      el.textContent = window.SITE.email;
      if (el.tagName === "A") el.href = "mailto:" + window.SITE.email;
    });
    $$("[data-disclaimer]").forEach(function (el) { el.textContent = window.SITE.disclaimer; });
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    var s = window.SITE.social || {};
    $$("[data-social]").forEach(function (a) {
      var key = a.getAttribute("data-social");
      if (s[key]) { a.href = s[key]; } else { a.remove(); }
    });
  }

  /* Duplicate the ticker track so the marquee loops seamlessly */
  function ticker() {
    var track = $(".ticker__track");
    if (!track || track.children.length < 2) return;
    track.innerHTML = track.innerHTML + track.innerHTML;
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function init() {
    header();
    drawer();
    chrome();
    ticker();
    rotator();
    issues();
    quotes();
    newsPreview();
    newsList();
    postPage();
    donate();
    donateLinks();
    forms();
    counters();
    reveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
