# How to post news (for the campaign team)

Everything on the **News** page can be added right here on GitHub, in your web
browser. **No coding, no software, and nobody else has to do anything.** You just
fill in a form.

There are three ways to add something. Pick whichever fits:

1. [Write a blog post](#1-write-a-blog-post) — your own update or announcement.
2. [Add a news link](#2-add-a-news-link) — a story from a newspaper or TV station.
3. [Approve a suggested story](#3-approve-a-suggested-story) — from the daily robot.

You'll need a free GitHub account (github.com → **Sign up**) and an invite to this
project. If you can see the **Issues** tab, you're all set.

---

## 1. Write a blog post

1. Go to the **Issues** tab at the top.
2. Click the green **New issue** button.
3. Next to **📝 New blog post**, click **Get started**.
4. Fill in the boxes:
   - **Headline** — the title of the post.
   - **Date** — leave blank for today.
   - **Category** — pick one (it becomes a filter button on the News page).
   - **One-sentence summary** — shown on the news card and when it's shared on
     Facebook.
   - **Post text** — write it normally. A blank line starts a new paragraph.
5. Click **Submit new issue**.

That's it. Within a minute or two the post appears on the News page automatically,
and the form closes itself. You don't run anything.

> **Tip:** to make a word **bold**, put two stars around it: `**like this**`.
> To add a link, write `[the words people click](https://the-web-address.com)`.

Want to hold a post back? Tick **"Keep this as a draft for now"** and it's saved
but not shown. (Delete that draft later from the **content/news** folder, or ask
whoever set this up.)

---

## 2. Add a news link

Great when a newspaper or TV station covers Rep. Hulsey and you want it on the site.

1. Go to **Issues** → **New issue** → **🔗 Submit a news link** → **Get started**.
2. Paste the **link** to the article. That's the only required box.
   (Optionally add a headline or a sentence of context.)
3. Click **Submit new issue**.

The system reads the article and formats a tidy news card that links out to the
full story — you don't copy any text yourself.

**One quick approval keeps the News tab clean:** a team member opens the new issue
and either

- adds the **`approved`** label (right sidebar → **Labels** → click **approved**), or
- types a comment that says **`/approve`**.

The moment it's approved, it publishes and the issue closes. To pass on a story
instead, just **Close** the issue.

> There's also a **"Share a news link"** page on the website itself (linked at the
> bottom of the News page) so supporters can send links in. Those arrive here the
> same way, and still wait for a team member's approval.

---

## 3. Approve a suggested story

Every morning a helper searches the news for fresh, **positive** stories about Rep.
Hulsey and drops each one into the **Issues** tab, already formatted and ready.
Nothing it finds goes live on its own — you decide.

1. Open the **Issues** tab. Suggested stories are labeled **`news-link`** and
   **`needs-review`**.
2. Open one and read it. If it looks good and puts the Rep in a good light:
   - add the **`approved`** label (or comment **`/approve`**), and it publishes.
3. If it's off-topic or you'd rather skip it, just **Close** the issue.

The helper already skips anything that reads negative, and never suggests the same
story twice — but **you always have the final say.**

---

## Editing or removing a post after it's up

Posts live as simple text files in the **`content/news`** folder.

- **Edit:** open the file there, click the pencil ✏️, make changes, and click
  **Commit changes**. The site updates itself.
- **Remove:** open the file, click the trash 🗑️ icon, and **Commit changes**.

If you'd rather not touch the folder, just open a new issue describing the change
and a teammate can handle it.

---

## If something doesn't show up

- Give it two or three minutes — the site rebuilds itself after each change.
- If you submitted a link or a suggested story, check that it was **approved**
  (added the `approved` label or an `/approve` comment). Unapproved links wait.
- If a form couldn't be published, the helper leaves a comment on that issue
  explaining exactly what to fix. Edit the issue and approve it again.

That's everything. Welcome aboard.
