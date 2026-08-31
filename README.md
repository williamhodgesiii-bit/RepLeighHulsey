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
| `news/<slug>.html` | One page per post, generated from `content/news/` |
| `news-post.html` | Forwards old `?p=slug` links to the new post pages |
| `donate.html` | Contribution page |
| `contact.html` | Volunteer and contact form |
| `404.html` | Page not found |

---

## Posting without a developer

The campaign can add everything on the News page from the browser, with no build
step and no developer involved. Two short guides cover it:

- **[`SETUP.md`](SETUP.md)** — the one-time setup the repo owner does once (about
  five minutes, all in browser settings).
- **[`POSTING.md`](POSTING.md)** — the everyday guide to hand the team. Three ways
  to post, all no-code:
  1. **Write a blog post** — fill in an issue form; it publishes itself.
  2. **Add a news link** — paste a URL; it's auto-formatted after a one-click approval.
  3. **Approve a suggested story** — a daily robot proposes fresh, positive news to
     review.

How that works under the hood is in [How the automation works](#how-the-automation-works)
below. The Markdown format described next still works too, and is what everything
ultimately produces.

## The news section

Posts are written as Markdown files in **`content/news/`**. One file is one post.
`build-news.js` turns them into the news section.

```
content/news/town-hall-in-helena.md   ->   /news/town-hall-in-helena.html
```

Each file starts with five fields, then the text of the post:

```markdown
---
title: Hulsey to Host Town Hall in Helena
date: 2026-09-14
category: Events
excerpt: Rep. Hulsey will hold an open town hall at Helena City Hall on September 27.
---

Write the post here. Blank lines separate paragraphs.

## A heading

- A list
- Another point

**Bold**, *italics* and [links](https://example.com) all work.
```

Then run:

```
npm run build
```

That regenerates the post pages, `assets/js/posts.js`, `feed.xml` and
`sitemap.xml`. **You rarely need to run this yourself** — a GitHub Action
(`.github/workflows/build.yml`) runs it automatically whenever a post changes and
commits the result, so adding a Markdown file in GitHub's web editor is enough to
publish. On Vercel or Netlify the same command also runs on every push.

**`POSTING.md` is the guide to hand the campaign.** It covers the same ground in
plain language, with no assumed technical background.

### What the build gives each post

- Its own address, e.g. `/news/focus-act-signed-into-law.html`
- A `<title>`, description, canonical link and `NewsArticle` structured data
- Facebook and X preview tags carrying that post's own headline and excerpt,
  so a shared link shows the story rather than a generic site card
- The full text in the HTML, so search engines can read it without running
  JavaScript
- A card on the news page and, if it is one of the three newest, on the home page
- An entry in `feed.xml` and `sitemap.xml`

### Safeguards

- The build validates every post first and refuses to publish if a title, date or
  excerpt is missing or malformed, naming the file and the problem.
- `draft: true` in the front matter keeps a post out of the site.
- Renaming or deleting a Markdown file removes its old page on the next build.
- Old `news-post.html?p=slug` links still resolve, so anything already shared
  keeps working.

### Categories

The filter buttons on the news page are built from whatever categories exist in
the files. Adding `category: Events` to a post is all it takes for an Events
button to appear.

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

Photographs live in `assets/img/`. Every framed photo is cropped by CSS
(`object-fit: cover`), so you can drop in a replacement of any shape and it will
still sit correctly in its frame — no need to pre-crop the file.

| File | Where it appears |
| --- | --- |
| `leigh-portrait.jpg` | Home hero and About sidebar (the main portrait) |
| `leigh-house-floor.jpg` | Home "About Leigh" section |
| `leigh-community.webp` | Home full-width photo band |
| `leigh-press.jpg` | About page, in the biography |
| `leigh-headshot.jpg` | Contact page sidebar |

To swap any photo, replace the file at the same path (keep the name) and it is
picked up automatically. Larger, higher-resolution images look best; the frames
scale them down cleanly. Additional photographs from district events would also
strengthen the news cards, which are currently text only.

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

## How the automation works

All of it runs on GitHub Actions and plain Node with **no dependencies** — the same
philosophy as the rest of the site. Nothing runs on the web server.

**Everything reduces to one idea:** a Markdown file in `content/news/` is a post.
The features below are just no-code ways to create that file, plus a build that runs
itself.

| Piece | File | What it does |
|---|---|---|
| Auto-build | `.github/workflows/build.yml` | On any change to `content/news/**`, runs `build-news.js` and commits the regenerated pages, feed and sitemap. Removes the "run the build" step entirely. |
| Post / link forms | `.github/ISSUE_TEMPLATE/new-post.yml`, `news-link.yml` | Fill-in-the-blanks issue forms so non-technical staff never touch Markdown. |
| Publish from a form | `.github/workflows/publish-from-issue.yml` → `scripts/issue-to-post.js` | Turns a submitted form into a post. Team posts auto-publish; links publish after a team member adds the **`approved`** label or comments `/approve`. |
| Daily news robot | `.github/workflows/discover-news.yml` → `scripts/discover-news.js` | Searches Google News (no API key), drops anything negative or already-seen, and opens a pre-filled review issue for each new story. |
| On-site submission | `submit-news.html` | A "share a link" page that deep-links into the pre-filled news-link form, with an email fallback. Linked from the News page. |
| Label setup | `.github/workflows/bootstrap-labels.yml` | Creates the labels the forms rely on, the first time it lands on `main`. |
| Shared helpers | `scripts/lib.js` | Markdown front-matter writing, issue-form parsing, page-metadata extraction, the vetting heuristic, and the de-duplication ledger (`data/seen-news.json`). |

**Vetting and safety.** Nothing external publishes on its own. Pasted and
auto-discovered links always wait for a human to approve (only repo collaborators
can add the `approved` label, so approval is inherently trusted). The robot's
keyword filter in `scripts/lib.js` (`vetHeadline`) is only a first pass — the human
approval is the real gate. Submitted text is treated as data: issue bodies are read
from environment variables (never interpolated into a shell), slugs are sanitized to
`[a-z0-9-]` so nothing can be written outside `content/news/`, and the existing
`build-news.js` escapes all post content into HTML.

**Requirements.** GitHub Actions must have **read and write** workflow permissions
(set once — see `SETUP.md`). The workflows use only the built-in `GITHUB_TOKEN`; no
secrets or API keys are needed.

To change what the robot searches for, edit `QUERIES` (or set the `NEWS_QUERIES`
environment variable) in `scripts/discover-news.js`; to change how many stories it
proposes per day, edit `MAX_NEW_PER_RUN`. To widen or tighten what it filters out,
edit the `NEGATIVE` list in `scripts/lib.js`.

---

## Deploying

These are static files and will work on any host.

- **GitHub Pages** — the simplest option, and it pairs with the automation with no
  extra configuration. Settings → Pages → Deploy from a branch → `main` / root. The
  auto-build Action commits the generated pages to `main`, so Pages always serves the
  latest. (See `SETUP.md`.)
- **Vercel or Netlify** — connect the repository, framework preset "Other", build
  command `npm run build`, output directory `.`. With the build command set, a
  staffer can add a post through GitHub in the browser and the site updates itself.
- **Traditional hosting** — run `npm run build` locally, then upload the folder.
  The generated pages are committed, so the site also works if uploaded as-is.

The publishing automation (forms, approvals, the daily robot) needs GitHub Actions
to have **read and write** permissions — a one-time setting covered in `SETUP.md`.

Update `robots.txt`, and `SITE_URL` in `build-news.js`, if the domain is not
`hulseyforhouse.com`.

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
- Post pages are plain HTML and need no JavaScript. The news index uses JavaScript
  for its filter and search, and falls back to nothing if scripts are blocked, so
  the posts themselves remain reachable through their own links, the feed and the
  sitemap.
- `SITE_URL` at the top of `build-news.js` sets the domain used in social preview
  tags, the feed and the sitemap. Change it there if the site launches elsewhere,
  then run `npm run build`.

### Testing

Verified in headless Chromium at 320, 390, 430, 768, 1280 and 1600 pixels wide
across all eight pages: no JavaScript errors, no horizontal overflow, and no tap
target under 40px. Interaction checks cover the mobile menu (including its open
animation and Escape to close), the sticky mobile bar appearing and retracting at
the footer, hero column order on mobile and desktop, staggered reveals, news
filters and search, article routing, the donation amount picker and form
validation, plus a reduced-motion pass.
