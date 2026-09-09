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
step and no developer involved. There are two ways in, and they write the same
files:

- **The editor at [`/admin`](admin/index.html)** — a real editing screen with a
  live preview of the finished page. This is the one to hand the team.
  **[`EDITOR.md`](EDITOR.md)** is its guide, written for someone with no
  technical background.
- **GitHub issue forms** — fill-in-the-blanks forms for people who would rather
  not sign into anything new, plus a daily robot that proposes fresh news for a
  one-click approval. **[`POSTING.md`](POSTING.md)** covers those.

**[`SETUP.md`](SETUP.md)** is the one-time setup the repo owner does once (about
five minutes, all in browser settings).

How all of it works under the hood is in
[The website editor](#the-website-editor) and
[How the automation works](#how-the-automation-works) below. The Markdown format
described next still works too, and is what everything ultimately produces.

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

Photographs live in `assets/img/`. Each one is shown at its own native shape and
never scaled up past the pixels it actually has, which is what keeps them sharp.
Every picture sits in a `.media` box that reserves its space from the aspect
ratio before the file arrives, so the page does not jump while photos load.

| File | Size | Shape | Where it appears |
| --- | --- | --- | --- |
| `leigh-portrait.jpg` | 447 x 447 | square | Home hero, About sidebar |
| `leigh-press.jpg` | 554 x 554 | square | Home "About Leigh", Donate sidebar |
| `leigh-house-floor.jpg` | 738 x 414 | 16:9 | Home record panel, About page |
| `leigh-headshot.jpg` | 640 x 320 | 2:1 | Contact sidebar |
| `leigh-community.webp` | 1439 x 809 | 16:9 | Home and Issues photo bands, About page |

The two full-bleed photo bands use `leigh-community.webp` because it is the only
file with enough pixels to cover the width of a screen. The others are shown in
frames sized to suit them.

To swap a photo, replace the file at the same path, keep the name, and update the
`width` and `height` attributes on the `<img>` tags that use it (search the HTML
for the filename). If the replacement has a different shape, change the frame's
modifier class to match — `.media--square`, `.media--wide` (16:9) or
`.media--pano` (2:1) — rather than letting the frame crop it.

Higher-resolution originals of these same photographs would sharpen the hero
portrait in particular: at 447px it is the tightest of the five against the size
it is displayed at.

Photographs attached to a blog post land in `assets/img/news/` automatically,
named after the post. They are referenced from the post's `image:` front-matter
field and are used for the news card, the top of the article, and the social
sharing preview. Nothing needs to be resized first.

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

## The website editor

`admin/` is a single page that reads and writes the Markdown files in
`content/news/` through GitHub's API. No server, no database, no build step, no
dependencies — the same philosophy as the rest of the project. Publishing is one
commit; the existing build Action turns it into the live pages a minute later.

**The preview is the published page.** This is the part worth protecting. The
editor does not approximate the post page — it calls the same code that writes
it:

| Shared module | Used by |
|---|---|
| `assets/js/markdown.js` | `build-news.js` and the editor, for the Markdown rules |
| `assets/js/post-template.js` | `build-news.js` and the editor, for the page itself |
| `assets/js/site.js` (`window.SiteCards`) | the news page and the editor, for the news card |
| `assets/js/cms.js` | `scripts/cms-check.js` and the editor, for reading and writing the pages |

Both modules run unchanged in Node and in the browser. If the template changes,
the preview changes with it, and there is no second copy to forget. The editor
asks the template for a script-free page (`scripts: false`); post pages need no
JavaScript to read, so what it shows is what a visitor sees.

### Editing the pages themselves

The news section is generated from Markdown, so editing it is a matter of
writing a file. The other five pages are hand-written HTML, and rewriting them
as templates would have meant giving up the thing that makes them worth having.
So the editor edits them where they are.

**One attribute makes an element editable.** Nothing else is needed:

```html
<h2 data-cms="home.about.heading" data-cms-label="Heading">About Leigh</h2>
```

`assets/js/cms.js` scans a page for those attributes, reads what is inside them,
and writes new content back into exactly that slice of the file. Everything
else — the markup, the classes, the indentation, the comments — is untouched.

| Attribute | What it does |
|---|---|
| `data-cms="path"` | this element's content is a field |
| `data-cms-type` | `text` (default), `inline` (bold, links, line breaks), `rich` (headings and lists too), `url` |
| `data-cms-attr="src:path, alt:path"` | an attribute is a field — images and links |
| `data-cms-list="path"` + `data-cms-item` | the children repeat, and can be added, removed and reordered |
| `data-cms-label` / `-help` / `-group` | what the editor calls it, the hint under it, which section it sits in |
| `data-cms-min` / `-max` / `-item-label` | how many items a list may hold, and what to call one |

**The form is derived from the page.** There is no schema file to keep in step:
`CMS.schema(html)` reads the annotations and the editor draws controls from
them. Annotating an element is the whole job of making it editable.

**A value is stored as the exact text already in the page**, so reading a page
and writing it straight back returns the identical file, byte for byte.
`scripts/cms-check.js` asserts that on every page on every build, which is what
makes this safe: if an annotation is put somewhere the scanner cannot match — a
list whose items are not all built the same way, say — the build fails there
rather than the editor mangling a page later. Only a field somebody actually
edits ever changes.

**The preview is the file that will be committed.** `CMS.write()` produces it,
the iframe shows it, and Publish commits it. Hovering the preview outlines what
is editable and clicking jumps to the field, through a small script injected
into the preview only.

Currently 110 fields and 14 repeatable lists across the five pages. To make
something else editable, add the attribute and run `npm run build`.

**Two things are not annotated on purpose.** The `<p class="legal">` block on
the donate page carries `<span data-disclaimer>`, which `site.js` fills from
settings at runtime — editing that paragraph as text would drop the span, so the
disclaimer is edited under Settings instead. The volunteer form's fields are
structure rather than content.

**The menu** is the one thing that is the same on every page and different on
each, since the current page's link is marked. `CMS.navWrite()` rebuilds it per
page, and saving it in Settings commits every page plus `post-template.js`
together, so the news posts follow.

**What it does**

- Edits every page of the website: headings, paragraphs, photos, buttons,
  captions, page titles and search descriptions, plus lists that can grow and
  shrink — priority cards, headline numbers, quick facts, suggested amounts.
- Keeps a photo library: every picture on the site, with upload and reuse.
- Holds the site-wide settings and the menu in one place.
- Writes, edits, hides and deletes posts, with the same front matter
  `scripts/lib.js` writes, so a post from the editor and one from an issue form
  are the same file.
- Resizes photographs in the browser before upload (max 1600px wide, JPEG) and
  commits them to `assets/img/news/` named after the post.
- Publishes the post and its photograph in **one commit** through the git data
  API, so the site is never briefly pointing at an image that has not arrived.
- Watches the build Action and reports "live" when it actually is.
- Warns if someone else changed the post while it was open.
- Keeps unsaved work in the browser, so a closed tab loses nothing.
- Three previews: the page, the news card, and what Facebook, a text message and
  Google show.

**Signing in.** Two options, and the editor picks on its own:

1. **Access key (works anywhere, including GitHub Pages).** A staffer follows a
   prefilled link, generates a GitHub token and pastes it once. It is kept in
   that browser only.
2. **One-click sign in (needs a host that runs functions — Vercel, Netlify).**
   Deploy `api/github-auth.js`, create a GitHub OAuth app and set
   `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Setup notes are at the top of
   that file. The editor probes for it on load and shows the button if it is
   there.

Reading needs no sign-in at all while the repository is public: anyone can open
the editor and preview posts, and it only asks who you are at the moment
something is published.

**Settings.** `DEFAULTS` at the top of `admin/admin.js` holds the owner, repo,
branch and canonical site address. They can also be changed from Help → Settings
in the editor itself, which stores an override in that browser — handy if the
repository is renamed. `robots.txt` disallows `/admin/` and the page carries a
`noindex` tag.

---

## How the automation works

All of it runs on GitHub Actions and plain Node with **no dependencies** — the same
philosophy as the rest of the site. Nothing runs on the web server.

**Everything reduces to one idea:** a Markdown file in `content/news/` is a post.
The features below are just no-code ways to create that file, plus a build that runs
itself.

| Piece | File | What it does |
|---|---|---|
| The editor | `admin/` | Writes the same Markdown files, and the pages themselves, from a browser with a live preview. See above. |
| Editor safety check | `scripts/cms-check.js` | Fails the build if any page can no longer be edited without damage. |
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
  `clamp()` scale, tightened again below 720px so the page does not run on. On the
  home page the hero reorders to name, photo, then text, and carries the three
  headline numbers inside the navy panel rather than in a separate strip below it.
  Below 660px the issue and news grids become horizontal snapping rails with a
  progress indicator, which keeps six cards to one screen instead of six. The menu
  opens as an overlay and locks the page behind it. A sticky Donate/Volunteer bar
  appears once the visitor scrolls past the opening screen and retracts when the
  footer arrives; it is hidden entirely on the donate and contact pages, where
  those actions are already on the page.
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
