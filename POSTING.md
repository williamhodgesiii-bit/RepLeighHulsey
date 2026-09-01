# Posting to the News page

Everything on the News page is managed from the **Issues** tab of this
repository. There is no separate login, no password to remember, and nothing
you can break — every change is recorded and can be undone.

Four things you can do:

| I want to… | Use the form called |
| --- | --- |
| Write a post | 📝 **New blog post** |
| Fix a typo or change a post already up | ✏️ **Edit a post that is already up** |
| Take a post down | 🗑️ **Delete a post** |
| Share a news story someone else wrote | 🔗 **Submit a news link** |

---

## Writing a post

1. Go to the **Issues** tab and press **New issue**.
2. Choose **📝 New blog post**.
3. Fill in the headline, the one-sentence summary, and the post text.
4. Press **Submit new issue**.

That's it. In a minute or two you'll get a reply on the issue with a link to
the live post, and the issue closes itself.

### The three fields that matter

**Headline** — what people see on the news card, at the top of the post, and in
Google results. Eight to twelve words is the sweet spot.

**One-sentence summary** — this is doing more work than it looks. It appears on
the news card, it is what Facebook and iMessage show when someone shares the
post, and it is the description Google puts under your link. Write it as a
complete sentence, not a fragment.

**Post text** — write normally. A blank line starts a new paragraph, and a
single new line stays a new line, so an address block like this comes out the
way you typed it:

```
When: Saturday, September 27, 10:00 a.m. to noon
Where: Helena City Hall, 816 Highway 52 East
```

### Adding a photo

Drag a photo into the **Photo** box, or click it and pick a file. The photo
becomes the picture on the news card, the picture at the top of the post, and
the picture people see when they share it — which is the single biggest thing
you can do to make a post get read.

Landscape photos work best. Big files are fine; they get handled for you.

Fill in the **What is happening in the photo?** box too. It shows as the caption
under the photo, and it is what a screen reader and Google read.

### A bit of formatting, if you want it

You do not need any of this — plain text is fine. But these work:

| Type this | To get |
| --- | --- |
| `## A heading` on its own line | A section heading |
| `- ` at the start of a line | A bullet point |
| `**important**` | **important** |
| `> ` at the start of a line | An indented quote |
| `[click here](https://example.com)` | A link |
| `[our issues page](issues.html)` | A link to another page on this site |

---

## Fixing a post that is already up

Use **✏️ Edit a post that is already up**. Paste the post's web address, then
fill in only the parts you want to change — anything you leave blank stays as
it is.

The post keeps the same web address, so any link already shared, posted or
emailed keeps working. This is the reason to edit rather than delete and repost.

To hide a post temporarily without losing it, tick the **hide this post** box on
the edit form. Untick it later to bring it back.

---

## Taking a post down

Use **🗑️ Delete a post**. Paste the post's web address and tick the confirm box.

The post disappears from the News page, the RSS feed and the sitemap within a
minute or two. Google drops it from search results over the following few days
on its own.

If you only want it gone for a while, hide it with the edit form instead.

---

## Search engines

You do not have to do anything for SEO. Every time you publish, edit or delete a
post, the site automatically updates:

- the post's own title, description and social sharing image
- the sharing preview for Facebook, X, LinkedIn and text messages
- structured data telling Google this is a news article, who wrote it, when it
  was published and when it was last changed
- `sitemap.xml`, which is what search engines read to find new pages
- `feed.xml`, the RSS feed

The one thing that actually moves the needle is the part only you can do: a
clear headline, a real sentence in the summary box, and a photo.

---

## Questions people ask

**Does anything go live before I'm ready?** No. Nothing is published until you
press Submit, and drafts stay off the site entirely.

**Can I write a post now and publish it later?** Yes — tick **Save as a draft**.
It is saved but stays off the website. Use the edit form and untick the hide box
when you want it live.

**I made a mistake and already submitted.** Use the edit form. If the post
shouldn't exist at all, use the delete form.

**Someone outside the campaign submitted something.** It waits. Posts from
outside the campaign team are never published until someone with access adds the
**approved** label or comments `/approve`.

**Something went wrong.** The reply on your issue says what needs fixing, and
nothing on the website changed. Correct the issue, then add the **approved**
label to try again.

---

## For a developer

Posts are Markdown files in `content/news/`. `build-news.js` turns them into
`news/*.html`, `assets/js/posts.js`, `feed.xml` and `sitemap.xml`. Run
`npm run build` after editing by hand.

The automation lives in `scripts/issue-to-post.js` and
`.github/workflows/publish-from-issue.yml`. Photos attached to a form are copied
into `assets/img/news/` so the site never depends on a link that might expire.

Front matter fields: `title`, `date`, `category`, `excerpt`, and optionally
`image`, `imageAlt`, `updated`, `source`, `draft`.
