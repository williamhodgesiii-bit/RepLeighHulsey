# Hulsey for House — campaign website

Static site for Rep. Leigh Hulsey, Alabama House District 15. No build step, no
framework, no dependencies. Open `index.html` in a browser and it runs.

Built to the brief: a few pages, simple and straightforward, visually strong, and
built mobile-first since most visitors will be on a phone.

---

## Pages

| File | What it is |
|---|---|
| `index.html` | Home — hero, record stats, bio preview, six priorities, timeline, quotes, latest news, email signup |
| `about.html` | Meet Leigh — full bio, quick facts, two-column path timeline |
| `issues.html` | Priorities — six issues in depth, sticky headings on desktop |
| `news.html` | News index — live search + category filters |
| `news-post.html` | Individual article, rendered from `posts.js` via `?p=slug` |
| `donate.html` | Donation page — amount picker, one-time/monthly toggle |
| `contact.html` | Get Involved — volunteer form, contact details, email signup |
| `404.html` | Not found |

---

## Adding a news post

Everything lives in **`assets/js/posts.js`**. Copy a block, paste it at the top of
the array, edit the fields, save. The post appears on the news page, in the
filters, in search, on the homepage, and gets its own URL. Nothing else to touch.

```js
{
  slug: "my-new-post",              // becomes news-post.html?p=my-new-post
  title: "Headline goes here",
  date: "2026-09-14",               // YYYY-MM-DD, sorting is automatic
  category: "District",             // reuse one or invent a new one; filters build themselves
  excerpt: "One or two sentences for the card.",
  body: `
    <p>Paragraphs in plain HTML.</p>
    <h2>A subheading</h2>
    <ul><li>A list item</li></ul>
  `,
},
```

Reading time, date formatting, prev/next links and share buttons are all
generated. Category filter buttons are built from whatever categories exist.

---

## Configuration

One block at the top of **`assets/js/site.js`** drives the whole site:

```js
window.SITE = {
  donateUrl:    "…",   // the live WinRed page — amount + frequency get appended
  formEndpoint: "",    // form POST target; empty = falls back to the visitor's email client
  email:        "…",   // shown in the footer and on the contact page
  social:       { facebook: "…", instagram: "…", x: "" },  // empty string hides that icon
  disclaimer:   "Paid for by Hulsey for House.",
};
```

### Before this goes live

These are placeholders and need real values from the campaign:

- [ ] **`donateUrl`** — the actual WinRed/processor URL. Currently a plausible guess.
- [ ] **`formEndpoint`** — a Formspree/Netlify Forms endpoint. Until one is set, the
      volunteer and signup forms open the visitor's mail client instead of posting
      anywhere. Works, but it loses people.
- [ ] **`email`** — `info@hulseyforhouse.com` is assumed, not confirmed.
- [ ] **Social URLs** — currently generic. Any left empty are hidden automatically.
- [ ] **`disclaimer`** — must match what the campaign files with the Alabama
      Secretary of State. Compliance should sign off on the donate page wording.
- [ ] **Endorsements** — deliberately not included. Past cycles saw support from
      ALFA, the Business Council of Alabama and BamaCarry, but current-cycle
      endorsements shouldn't be published without confirmation. There's a natural
      slot for them in the navy section of the homepage.

### Photography

**The headshot is 192×262px.** That's small. The layout works around it — the photo
sits in a framed portrait card at a modest size rather than as a full-bleed hero —
but a high-resolution image would let the hero do much more. Drop a replacement at
`assets/img/leigh-hulsey.jpg` and it picks up automatically; no CSS changes needed.

Worth shooting if there's budget: one high-res vertical portrait, plus 3–4 candids
(district events, the gym, the House floor). Those would upgrade the news cards,
which currently use a typographic treatment instead of photos.

---

## Content sourcing

Copy is drafted from public reporting on Rep. Hulsey's record — the FOCUS Act
(HB166, signed May 2025), HB399 on data center tax abatements (enacted April 2026),
the $360,000+ in district grant funding, her Helena City Council service, and her
2023 election as House GOP caucus freshman representative. Direct quotes are ones
she has given publicly.

**All of it should still get a read from the campaign before launch.** Voice,
emphasis and any characterization are drafts, not approved language.

---

## Deploying

It's static files, so anywhere works.

- **Vercel / Netlify** — connect this repo, framework preset "Other", no build
  command, output directory `.`. Or drag the folder into Netlify Drop.
- **Any host** — upload the folder. That's it.

After deploy, update `sitemap.xml` and `robots.txt` if the domain isn't
`hulseyforhouse.com`.

---

## Technical notes

- **No dependencies.** One CSS file, two JS files. Nothing to install, nothing to
  keep patched, nothing that breaks in two years.
- **Fonts** are Anton (display, chosen to echo the logo's heavy condensed
  lettering) and Source Sans 3, loaded from Google Fonts with a real fallback
  stack. Self-hosting them is a reasonable future change for speed and privacy.
- **Brand colors** are sampled from the logo: red `#ED2424`, navy `#262262`.
- **Accessibility** — skip link, semantic landmarks, keyboard-operable menu and
  accordions, `aria-expanded`/`aria-current` state, visible focus rings, live
  region on the news filter results.
- **Motion** respects `prefers-reduced-motion`: the ticker, the rotating headline,
  the counters and every scroll reveal all stand down for visitors who ask for it.
- **Progressive enhancement** — the interactive pieces layer on top of working
  HTML. The news index and article pages do require JS, since posts render from
  `posts.js`; if the campaign ever wants those pre-rendered for SEO, a small build
  script can generate static article pages from the same file.

### Verified

Rendered and tested in headless Chromium at 390px and 1440px across all pages:
no console errors, no horizontal overflow, and the mobile menu, accordions,
counters, headline rotator, quote carousel, news search/filter, article routing,
donation amount picker and form validation all confirmed working.
