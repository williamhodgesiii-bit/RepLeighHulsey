# Hulsey for House — campaign website

Static website for Rep. Leigh Hulsey, Alabama House District 15.

Plain HTML, one stylesheet, two small scripts. No framework, no dependencies, no
build step. Open `index.html` in a browser and it works.

---

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home page |
| `about.html` | Full biography |
| `issues.html` | On the Issues |
| `news.html` | News index with category filters and search |
| `news-post.html` | Individual article, loaded from `posts.js` via `?p=slug` |
| `donate.html` | Contribution page |
| `contact.html` | Volunteer and contact form |
| `404.html` | Page not found |

---

## Adding a news post

All news content is in **`assets/js/posts.js`**. Copy one block, paste it at the
top of the list, change the fields, and save. The post appears on the news page,
in the category filters, in the search, on the home page, and at its own address.

```js
{
  slug: "my-new-post",        // address becomes news-post.html?p=my-new-post
  title: "Headline",
  date: "2026-09-14",         // YYYY-MM-DD; sorting is automatic
  category: "District",       // reuse a category or add a new one
  excerpt: "One or two sentences for the news card.",
  body: `
    <p>Paragraphs in plain HTML.</p>
    <h2>A subheading</h2>
    <ul><li>A list item</li></ul>
  `,
},
```

Dates, filter buttons and previous/next links are generated automatically.

---

## Settings

One block at the top of **`assets/js/site.js`** controls the site:

```js
window.SITE = {
  donateUrl:    "…",   // the live donation page; amount and frequency are appended
  formEndpoint: "",    // where forms submit; blank falls back to the visitor's email program
  email:        "…",   // shown in the footer and on the contact page
  social:       { facebook: "…", instagram: "…", x: "" },  // blank hides that icon
  disclaimer:   "Paid for by Hulsey for House.",
};
```

### Needed before launch

These are placeholders:

- [ ] **`donateUrl`** — the campaign's actual WinRed or Anedot page.
- [ ] **`formEndpoint`** — a Formspree, Netlify Forms or Google Form endpoint. Until
      one is set, the contact and signup forms open the visitor's email program.
- [ ] **`email`** — `info@hulseyforhouse.com` is assumed, not confirmed.
- [ ] **Social links** — currently generic. Any left blank are removed automatically.
- [ ] **Disclaimer** — must match the campaign's filing with the Alabama Secretary of
      State. Compliance should review the donate page language.
- [ ] **Endorsements** — not included. ALFA, the Business Council of Alabama and
      BamaCarry supported Rep. Hulsey in past cycles, but current endorsements should
      not be published without confirmation. There is room for a section on the home
      page between the record and the news.

### Photography

**The supplied headshot is 192 by 262 pixels**, which is small. The layout works
around it by presenting the photo in a bordered frame at a modest size rather than
as a full-width banner image.

A higher-resolution portrait would allow a stronger hero. Replace
`assets/img/leigh-hulsey.jpg` and it will be picked up automatically. Additional
photographs from district events would also improve the news cards, which are
currently text only.

---

## Content

Copy is drawn from Rep. Hulsey's public record: the FOCUS Act (HB166, signed May
2025), House Bill 399 on data center tax abatements (enacted April 2026), the
$360,000-plus in district grant funding, her service on the Helena City Council,
and her election as House Republican caucus freshman representative in January
2023. Quotations are ones she has given publicly.

**The campaign should review all copy before launch.** Wording and emphasis are
drafts, not approved language.

---

## Deploying

These are static files and will work on any host.

- **Vercel or Netlify** — connect the repository, framework preset "Other", no
  build command, output directory `.`. Or drag the folder onto Netlify Drop.
- **Traditional hosting** — upload the folder.

Update `sitemap.xml` and `robots.txt` if the domain is not `hulseyforhouse.com`.

---

## Notes

- **Fonts** are Oswald for headings and Open Sans for body text, loaded from Google
  Fonts with system fallbacks. Both are common on campaign sites. They can be
  self-hosted later for speed and privacy.
- **Colors** are taken from the logo: red `#ED2424` and navy `#262262`.
- **Brand elements.** Three motifs pulled from the logo run through the whole site:
  the full lockup (header, footer), the Alabama-and-elephant mark
  (`assets/img/mark.png`, cropped from the logo) used as a watermark, a portrait
  badge, an issue-card icon and a news-card marker, and the star-and-bar rule that
  sits above section headings. A faint star field textures the navy and gray panels.
- **Mobile.** Tap targets are at least 44-48px throughout. Spacing uses a fluid
  `clamp()` scale so padding tightens on small screens instead of jumping at
  breakpoints. On the home page the hero reorders on mobile to name, photo, then
  text. A sticky Donate/Volunteer bar appears once the visitor scrolls past the
  opening screen and retracts when the footer arrives; it is hidden entirely on the
  donate and contact pages, where those actions are already on the page.
- **Accessibility** — skip link, semantic headings, keyboard-accessible menu,
  `aria-expanded` and `aria-current` state, visible focus outlines, and a live
  region announcing news filter results.
- **Motion** is limited to a short fade-and-rise as sections scroll into view
  (cards in a grid stagger slightly), the mobile menu's height transition, and the
  sticky bar sliding in. All of it is disabled for visitors who set a reduced-motion
  preference.
- The news index and article pages require JavaScript, since posts are loaded from
  `posts.js`. If pre-rendered article pages are wanted for search engines later, a
  short script can generate them from the same file.

### Testing

Verified in headless Chromium at 320, 390, 430, 768, 1280 and 1600 pixels wide
across all eight pages: no JavaScript errors, no horizontal overflow, and no tap
target under 40px. Interaction checks cover the mobile menu (including its open
animation and Escape to close), the sticky mobile bar appearing and retracting at
the footer, hero column order on mobile and desktop, staggered reveals, news
filters and search, article routing, the donation amount picker and form
validation, plus a reduced-motion pass.
