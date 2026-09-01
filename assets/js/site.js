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
    facebook: "https://www.facebook.com/HulseyForHouse/",
    instagram: "https://www.instagram.com/hulseyforhouse/",
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

  /* ---------- Scroll position, shared by the header and the mobile bar ---------- */
  function scrollWatchers() {
    var header = $(".header");
    var cta = $(".mobile-cta");
    var footer = $(".footer");
    if (!header && !cta) return;

    var ticking = false;
    function update() {
      var y = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle("is-stuck", y > 8);

      if (cta) {
        // Show once the visitor is past the opening screen, but get out of the
        // way when the footer (which carries its own links) comes into view.
        var footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
        var show = y > 420 && footerTop > window.innerHeight;
        cta.classList.toggle("is-visible", show);
      }
      revealScrolledPast();
      settlePhotos();
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ---------- Mobile menu ---------- */
  function menu() {
    var burger = $(".burger");
    var panel = $(".mobile-nav");
    if (!burger || !panel) return;

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      panel.setAttribute("aria-hidden", String(!open));
      // The panel overlays the page on a phone, so the page behind it should
      // not scroll away underneath the menu. The class goes on the scrolling
      // element, which is <html>, not <body>.
      document.documentElement.classList.toggle("nav-open", open && window.innerWidth < 1000);
    }
    setOpen(false);

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
      if (window.innerWidth >= 1000) setOpen(false);
    });
  }

  /* ---------- Fade sections in, with a small stagger inside grids ---------- */
  function fade() {
    var els = $$("[data-fade]");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute("data-fade-delay") || "0", 10);
        if (delay) {
          window.setTimeout(function () { el.classList.add("is-in"); }, delay);
        } else {
          el.classList.add("is-in");
        }
        io.unobserve(el);
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -4% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* Safety net. A fast scroll can carry an element past the viewport between
     observer callbacks, which would leave it stuck invisible. Anything whose top
     has already passed the top of the screen is revealed outright. Elements
     arriving normally are still handled by the observer, so the stagger is kept. */
  function revealScrolledPast() {
    if (reduceMotion) return;
    var pending = document.querySelectorAll("[data-fade]:not(.is-in)");
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].getBoundingClientRect().top < 0) pending[i].classList.add("is-in");
    }
  }

  /* Give cards inside a grid a staggered delay so they arrive in sequence. */
  function stagger() {
    if (reduceMotion) return;
    $$(".issue-grid, .news-list").forEach(function (grid) {
      $$("[data-fade]", grid).forEach(function (card, i) {
        card.setAttribute("data-fade-delay", String(Math.min(i, 5) * 70));
      });
    });
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
    // A post with a photograph leads with it; the rest keep the plain card.
    var media = p.image
      ? '<div class="news-item__media media media--wide">' +
          '<img src="' + escapeHTML(p.image) + '" alt="' + escapeHTML(p.imageAlt || p.title) +
          '" width="1600" height="900" loading="lazy" decoding="async">' +
        "</div>"
      : "";
    return (
      '<a class="news-item' + (p.image ? " news-item--photo" : "") + '" href="' +
        (p.url || ("news/" + p.slug + ".html")) + '" data-fade>' +
        media +
        '<div class="news-item__top">' +
          '<img src="assets/img/mark.png" width="101" height="138" alt="" aria-hidden="true">' +
          '<span class="news-item__cat">' + escapeHTML(p.category) + "</span>" +
          '<span class="news-item__date">' + formatDate(p.date) + "</span>" +
        "</div>" +
        '<div class="news-item__body">' +
          "<h3>" + escapeHTML(p.title) + "</h3>" +
          "<p>" + escapeHTML(p.excerpt) + "</p>" +
          '<span class="news-item__more">Read More</span>' +
        "</div>" +
      "</a>"
    );
  }

  /* ---------- News index: filters and search ---------- */
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
        var haystack = (p.title + " " + p.excerpt + " " + p.category + " " + (p.text || "")).toLowerCase();
        return inCategory && (!state.query || haystack.indexOf(state.query) !== -1);
      });
      list.innerHTML = matches.map(newsItemHTML).join("");
      // Results are injected after the observer ran, so reveal them directly.
      $$("[data-fade]", list).forEach(function (el) { el.classList.add("is-in"); });
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

  /* ---------- Old-style links (news-post.html?p=slug) ----------
     Posts now live at news/<slug>.html as real pages. Anything still
     pointing at the old address is forwarded so shared links keep working. */
  function legacyPostRedirect() {
    var root = document.getElementById("legacy-post");
    if (!root) return;

    var slug = new URLSearchParams(window.location.search).get("p");
    var match = (window.POSTS || []).filter(function (p) { return p.slug === slug; })[0];

    if (match) {
      window.location.replace(match.url || "news/" + match.slug + ".html");
      return;
    }
    root.innerHTML =
      '<div class="section"><div class="wrap-narrow text-center">' +
      "<h1>Page Not Found</h1>" +
      "<p>That link may be out of date. You can find all updates on the news page.</p>" +
      '<p style="margin-top:1.5rem"><a class="btn btn--navy" href="news.html">View All News</a></p>' +
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

    if ($(".mobile-cta")) document.body.classList.add("has-mobile-cta");
  }


  /* ---------- Photographs ----------
     Each picture sits in a .media box that already knows its aspect ratio, so
     the layout never shifts. Marking the image loaded fades it up over the
     placeholder; anything already in the cache is marked straight away. */
  function settlePhotos() {
    var pending = document.querySelectorAll(".media > img:not(.is-loaded)");
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].complete) pending[i].classList.add("is-loaded");
    }
    return pending.length;
  }

  function photos() {
    $$(".media > img").forEach(function (img) {
      img.addEventListener("load", function () { img.classList.add("is-loaded"); });
      img.addEventListener("error", function () { img.classList.add("is-loaded"); });
    });
    settlePhotos();
    // A lazily loaded picture can finish between the listener being attached
    // and the event being dispatched, and a picture must never be left sitting
    // at zero opacity, so sweep again as the page settles and as it scrolls.
    window.addEventListener("load", settlePhotos);
    window.setTimeout(settlePhotos, 1200);
    window.setTimeout(settlePhotos, 4000);
  }

  /* ---------- Rails ----------
     Below the two-column breakpoint the issue and news grids scroll sideways
     instead of running down the page. Where that is actually happening, add a
     progress indicator and make the rail reachable from the keyboard. */
  function rails() {
    $$("[data-rail]").forEach(function (rail) {
      var dots = document.createElement("div");
      dots.className = "rail-dots";
      dots.setAttribute("aria-hidden", "true");
      rail.insertAdjacentElement("afterend", dots);

      var count = 0;

      function isRail() { return rail.scrollWidth - rail.clientWidth > 8; }

      function build() {
        var items = rail.children.length;
        if (!isRail() || items < 2) {
          dots.innerHTML = "";
          count = 0;
          rail.removeAttribute("tabindex");
          rail.removeAttribute("role");
          return;
        }
        if (count !== items) {
          count = items;
          dots.innerHTML = new Array(items + 1).join("<b></b>");
        }
        rail.setAttribute("tabindex", "0");
        rail.setAttribute("role", "group");
        mark();
      }

      /* Which card is parked at the start of the rail. Measuring the cards
         beats dividing scrollLeft by the scrollable width, because the
         trailing gutter means the last card snaps well short of the end. */
      function mark() {
        if (!count) return;
        var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
        var origin = rail.getBoundingClientRect().left + pad;
        var active = 0;
        var nearest = Infinity;
        Array.prototype.forEach.call(rail.children, function (card, i) {
          var distance = Math.abs(card.getBoundingClientRect().left - origin);
          if (distance < nearest) { nearest = distance; active = i; }
        });
        Array.prototype.forEach.call(dots.children, function (dot, i) {
          dot.classList.toggle("is-on", i === active);
        });
      }

      var ticking = false;
      rail.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () { mark(); ticking = false; });
      }, { passive: true });

      window.addEventListener("resize", build, { passive: true });
      build();

      // The news rail is filled in by script, so rebuild once it has content.
      if (!rail.children.length) {
        new MutationObserver(build).observe(rail, { childList: true });
      }
    });
  }

  function init() {
    menu();
    chrome();
    newsPreview();
    newsIndex();
    photos();
    rails();
    legacyPostRedirect();
    donate();
    forms();
    stagger();
    fade();
    scrollWatchers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
