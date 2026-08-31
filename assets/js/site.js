/* ==========================================================================
   Hulsey for House — site.js
   Plain JavaScript, no dependencies.
   ========================================================================== */

/* --------------------------------------------------------------------------
   CONFIG — edit these values, the rest of the site follows.
   -------------------------------------------------------------------------- */
window.SITE = {
  // The campaign's live donation page (WinRed, Anedot, etc). The amount and
  // frequency selected on donate.html get appended to this URL.
  donateUrl: "https://secure.winred.com/hulsey-for-house/donate",

  // Where the contact, volunteer and email signup forms submit.
  // Paste a Formspree / Netlify Forms / Google Form endpoint here. If this is
  // left blank, the forms open the visitor's email program instead.
  formEndpoint: "",

  email: "info@hulseyforhouse.com",

  social: {
    facebook: "https://www.facebook.com/",
    instagram: "https://www.instagram.com/",
    x: "",
  },

  // Required on political material. Must match the campaign's filing with the
  // Alabama Secretary of State.
  disclaimer: "Paid for by Hulsey for House.",
};

(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile menu ---------- */
  function menu() {
    var burger = $(".burger");
    var panel = $(".mobile-nav");
    if (!burger || !panel) return;

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
    }
    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        setOpen(false);
        burger.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 992) setOpen(false);
    });
  }

  /* ---------- Gentle fade-in on scroll ---------- */
  function fade() {
    var els = $$("[data-fade]");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -5% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- News helpers ---------- */
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

  function formatDate(iso) {
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return MONTHS[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10) + ", " + p[0];
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function allPosts() {
    return (window.POSTS || []).slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
  }
  function newsItemHTML(p) {
    return (
      '<a class="news-item" href="news-post.html?p=' + encodeURIComponent(p.slug) + '">' +
        '<p class="news-item__meta">' + escapeHTML(p.category) +
          ' <span>&nbsp;|&nbsp; ' + formatDate(p.date) + "</span></p>" +
        "<h3>" + escapeHTML(p.title) + "</h3>" +
        "<p>" + escapeHTML(p.excerpt) + "</p>" +
        '<span class="news-item__more">Read More</span>' +
      "</a>"
    );
  }

  /* ---------- News index: filters + search ---------- */
  function newsIndex() {
    var list = $("#news-list");
    if (!list) return;

    var posts = allPosts();
    var filterWrap = $("#news-filters");
    var searchInput = $("#news-search");
    var state = { category: "All", query: "" };

    if (filterWrap) {
      var cats = ["All"];
      posts.forEach(function (p) {
        if (cats.indexOf(p.category) === -1) cats.push(p.category);
      });
      filterWrap.innerHTML = cats.map(function (c, i) {
        return '<button type="button"' + (i === 0 ? ' class="is-active"' : "") +
               ' data-category="' + escapeHTML(c) + '">' + escapeHTML(c) + "</button>";
      }).join("");
      filterWrap.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        $$("button", filterWrap).forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        state.category = btn.getAttribute("data-category");
        render();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.query = this.value.trim().toLowerCase();
        render();
      });
    }

    function render() {
      var matches = posts.filter(function (p) {
        var inCategory = state.category === "All" || p.category === state.category;
        var haystack = (p.title + " " + p.excerpt + " " + p.category + " " + p.body).toLowerCase();
        return inCategory && (!state.query || haystack.indexOf(state.query) !== -1);
      });
      list.innerHTML = matches.map(newsItemHTML).join("");
      var empty = $("#news-empty");
      if (empty) empty.style.display = matches.length ? "none" : "block";
      var count = $("#news-count");
      if (count) count.textContent = matches.length + (matches.length === 1 ? " post" : " posts");
    }

    render();
  }

  /* ---------- Latest three on the home page ---------- */
  function newsPreview() {
    var el = $("#news-preview");
    if (!el) return;
    el.innerHTML = allPosts().slice(0, 3).map(newsItemHTML).join("");
  }

  /* ---------- Single article ---------- */
  function articlePage() {
    var root = $("#article");
    if (!root) return;

    var slug = new URLSearchParams(window.location.search).get("p");
    var posts = allPosts();
    var i = posts.findIndex(function (p) { return p.slug === slug; });

    if (i === -1) {
      root.innerHTML =
        '<div class="section"><div class="wrap-narrow text-center">' +
        "<h1>Page Not Found</h1>" +
        "<p>That link may be out of date. You can find all updates on the news page.</p>" +
        '<p><a class="btn btn--navy" href="news.html">View All News</a></p>' +
        "</div></div>";
      return;
    }

    var post = posts[i];
    var older = posts[i + 1];
    var newer = posts[i - 1];

    document.title = post.title + " | Hulsey for House";
    var meta = $('meta[name="description"]');
    if (meta) meta.setAttribute("content", post.excerpt);

    var footer = "";
    if (older || newer) {
      footer = '<div class="article-foot">' +
        (older ? '<a href="news-post.html?p=' + encodeURIComponent(older.slug) +
                 '"><small>Previous</small>' + escapeHTML(older.title) + "</a>" : "<span></span>") +
        (newer ? '<a class="next" href="news-post.html?p=' + encodeURIComponent(newer.slug) +
                 '"><small>Next</small>' + escapeHTML(newer.title) + "</a>" : "") +
        "</div>";
    }

    root.innerHTML =
      '<div class="article-head"><div class="wrap-narrow">' +
        '<p class="article-head__meta">' + escapeHTML(post.category) +
          " <span>&nbsp;|&nbsp; " + formatDate(post.date) + "</span></p>" +
        "<h1>" + escapeHTML(post.title) + "</h1>" +
      "</div></div>" +
      '<div class="section"><div class="wrap-narrow">' +
        '<div class="article-body">' + post.body + "</div>" +
        footer +
        '<p style="margin-top:2rem"><a href="news.html">&laquo; Back to all news</a></p>' +
      "</div></div>";
  }

  /* ---------- Donation amount picker ---------- */
  function donate() {
    var box = $("#donate-box");
    if (!box) return;

    var amountButtons = $$(".amounts button", box);
    var other = $("#other-amount", box);
    var freqButtons = $$(".freq button", box);
    var submit = $("#donate-submit", box);
    var state = { amount: "50", frequency: "once" };

    function update() {
      amountButtons.forEach(function (b) {
        var on = b.getAttribute("data-amount") === String(state.amount);
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      var url = window.SITE.donateUrl;
      var query = "amount=" + encodeURIComponent(state.amount);
      if (state.frequency === "monthly") query += "&frequency=monthly";
      if (submit) {
        submit.href = url + (url.indexOf("?") === -1 ? "?" : "&") + query;
        submit.textContent = state.frequency === "monthly"
          ? "Give $" + state.amount + " Monthly"
          : "Give $" + state.amount;
      }
    }

    amountButtons.forEach(function (b) {
      b.addEventListener("click", function () {
        state.amount = b.getAttribute("data-amount");
        if (other) other.value = "";
        update();
      });
    });

    if (other) {
      other.addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9.]/g, "");
        if (this.value && parseFloat(this.value) > 0) state.amount = this.value;
        update();
      });
    }

    freqButtons.forEach(function (b) {
      b.addEventListener("click", function () {
        freqButtons.forEach(function (x) {
          x.classList.remove("is-active");
          x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("is-active");
        b.setAttribute("aria-pressed", "true");
        state.frequency = b.getAttribute("data-frequency");
        update();
      });
    });

    update();
  }

  /* ---------- Forms ---------- */
  function forms() {
    $$("form[data-form]").forEach(function (form) {
      var done = $("#" + form.getAttribute("data-done"));

      function setError(input, message) {
        var field = input.closest(".field");
        if (!field) return;
        field.classList.toggle("has-error", !!message);
        var box = $(".field__error", field);
        if (box) box.textContent = message || "";
        input.setAttribute("aria-invalid", message ? "true" : "false");
      }

      function validate(input) {
        var value = (input.value || "").trim();
        if (input.required && !value) {
          setError(input, "This field is required.");
          return false;
        }
        if (input.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          setError(input, "Please enter a valid email address.");
          return false;
        }
        setError(input, "");
        return true;
      }

      $$("input, textarea", form).forEach(function (input) {
        if (input.type === "checkbox") return;
        input.addEventListener("blur", function () { validate(input); });
        input.addEventListener("input", function () {
          var field = input.closest(".field");
          if (field && field.classList.contains("has-error")) validate(input);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var inputs = $$("input, textarea", form).filter(function (i) {
          return i.type !== "checkbox" && i.type !== "hidden";
        });
        var valid = true;
        inputs.forEach(function (i) { if (!validate(i)) valid = false; });
        if (!valid) {
          var first = $(".has-error input, .has-error textarea", form);
          if (first) first.focus();
          return;
        }

        var button = $('button[type="submit"]', form);
        var label = button ? button.textContent : "";
        if (button) { button.disabled = true; button.textContent = "Sending..."; }

        function finish() {
          form.reset();
          if (button) { button.disabled = false; button.textContent = label; }
          if (done) {
            form.hidden = true;
            done.classList.add("is-visible");
            done.setAttribute("tabindex", "-1");
            done.focus();
          }
        }

        if (window.SITE.formEndpoint) {
          fetch(window.SITE.formEndpoint, {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form),
          }).then(finish).catch(function () {
            if (button) { button.disabled = false; button.textContent = label; }
            alert("We could not send that. Please email " + window.SITE.email + " instead.");
          });
        } else {
          var lines = [];
          new FormData(form).forEach(function (value, key) {
            if (value) lines.push(key + ": " + value);
          });
          window.location.href = "mailto:" + window.SITE.email +
            "?subject=" + encodeURIComponent(form.getAttribute("data-subject") || "Website message") +
            "&body=" + encodeURIComponent(lines.join("\n"));
          setTimeout(finish, 400);
        }
      });
    });
  }

  /* ---------- Values pulled from the config block ---------- */
  function chrome() {
    $$("[data-email]").forEach(function (el) {
      el.textContent = window.SITE.email;
      if (el.tagName === "A") el.href = "mailto:" + window.SITE.email;
    });
    $$("[data-disclaimer]").forEach(function (el) { el.textContent = window.SITE.disclaimer; });
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    $$("[data-donate]").forEach(function (el) { el.href = window.SITE.donateUrl; });

    var social = window.SITE.social || {};
    $$("[data-social]").forEach(function (a) {
      var key = a.getAttribute("data-social");
      if (social[key]) { a.href = social[key]; } else { a.remove(); }
    });
  }

  function init() {
    menu();
    chrome();
    newsPreview();
    newsIndex();
    articlePage();
    donate();
    forms();
    fade();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
