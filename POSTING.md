# How to post news

Everything on the News page comes from the files in **`content/news/`**. One file
is one post. You do not need to touch any other part of the site.

---

## Write a post

Create a new file in `content/news/`. Name it the way you want the web address to
read, using lowercase letters and dashes, ending in `.md`.

```
content/news/town-hall-in-helena.md   ->   hulseyforhouse.com/news/town-hall-in-helena.html
```

Put this at the top of the file, between the two lines of dashes:

```markdown
---
title: Hulsey to Host Town Hall in Helena
date: 2026-09-14
category: Events
excerpt: Rep. Hulsey will hold an open town hall at Helena City Hall on September 27.
---

Write the post here.

Leave a blank line between paragraphs. That is all the formatting most posts need.

## A section heading

Use two number signs for a heading.

- A bulleted list
- Another point

Use **two asterisks** around words to bold them, and write a link like
[this](https://example.com).
```

### The five fields

| Field | What it does |
|---|---|
| `title` | The headline, shown on the card, the page and in Google results |
| `date` | `YYYY-MM-DD`. Posts sort newest first automatically |
| `category` | The filter button on the News page. Reuse one, or invent a new one and the button appears by itself |
| `excerpt` | One or two sentences. Shown on the news card and as the preview when the post is shared on Facebook |
| `draft` | Optional. Add `draft: true` to keep a post out of the site until it is ready |

If the title or excerpt contains a colon, wrap it in quotes:
`title: "Hulsey: Session Recap"`

---

## Publish it

```
npm run build
```

That regenerates the news pages, the feed and the sitemap. Then commit and push,
and the site updates.

If the campaign is hosted on Vercel or Netlify, this command runs automatically on
every push, so publishing is just: add the file, commit, done.

### What the build creates for each post

- Its own page at `news/<name>.html`
- A card on the News page and, if it is one of the three newest, on the home page
- A proper Facebook and X preview showing the post's own headline and excerpt
- An entry in `feed.xml` and in `sitemap.xml` for search engines

---

## Editing or removing a post

- **Edit** — change the `.md` file and run `npm run build` again.
- **Rename** — rename the `.md` file. The old page is deleted on the next build.
  Anyone who saved the old link lands on the News page rather than an error.
- **Delete** — delete the `.md` file and run `npm run build`.

---

## If the build stops

The build checks each post before writing anything and prints exactly what is
wrong, for example:

```
These posts need attention before the site can be built:

  - town-hall.md: date must look like 2026-04-09
```

Fix the file and run it again. Nothing is published until every post is valid.

---

## A note on formatting

Only the basics are supported, which is deliberate: headings (`##`), paragraphs,
bulleted and numbered lists, bold, italics, links and block quotes. That covers a
press release or an update, and it keeps every post looking consistent with the
rest of the site.
