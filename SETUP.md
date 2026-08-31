# One-time setup (about 5 minutes)

Do this once, and afterward your team can post to the blog and add news **without
you touching anything**. You only need a web browser — no software to install.

Everywhere below, "the repository" means this project's page on GitHub:
`https://github.com/williamhodgesiii-bit/RepLeighHulsey`

---

## Step 1 — Turn on the automation (required)

This lets the helper publish posts for you.

1. Open the repository on GitHub.
2. Click **Settings** (top row of tabs).
3. In the left sidebar click **Actions**, then **General**.
4. Scroll to the bottom, to **Workflow permissions**.
5. Choose **Read and write permissions**.
6. Click **Save**.

That's the only setting you have to change. Everything else is automatic.

---

## Step 2 — Let the labels create themselves (automatic)

The system uses a few colored labels ("approved", "news-link", and so on). A small
job creates them for you the first time everything is uploaded, so there's usually
nothing to do here.

To double-check, or if you ever need to run it by hand:

1. Click the **Actions** tab.
2. On the left, click **Set up labels**.
3. Click **Run workflow** → **Run workflow**.

If it shows a green checkmark, the labels exist. Done.

> If you see a **red ✗** on the very first run in the Actions tab, it just means
> that run happened before you finished **Step 1**. Do Step 1, then run **Set up
> labels** again as above — it'll be green. A red first run is harmless.

---

## Step 3 — Make sure the website is turned on

**If the site is already live** (someone set up hosting on Vercel, Netlify, or a
web host), skip this step.

**If it isn't live yet,** the simplest option is GitHub's own free hosting:

1. **Settings** → **Pages** (left sidebar).
2. Under **Source**, choose **Deploy from a branch**.
3. Set **Branch** to **main** and the folder to **/ (root)**. Click **Save**.
4. Wait a minute, then refresh. GitHub shows the web address at the top of that
   page (something like `https://williamhodgesiii-bit.github.io/RepLeighHulsey/`).

That address is your live site. When you're ready to use `hulseyforhouse.com`,
add it under **Pages → Custom domain**, and update two spots so links are correct:
`SITE_URL` near the top of `build-news.js`, and `REPO` near the bottom of
`submit-news.html` (only if you rename or move the repository).

---

## Step 4 — Add your team

Anyone you add here can post to the blog, approve news links, and run the robot —
all from their own GitHub account.

1. **Settings** → **Collaborators** (left sidebar).
2. Click **Add people** and type each person's GitHub username or email.
3. They get an emailed invitation. Once they accept, they're in.

They'll each need a free GitHub account (github.com, "Sign up"). That's the only
account anyone needs.

---

## Step 5 — (Optional) Try the daily news robot now

It runs on its own every morning, but you can kick it off immediately:

1. **Actions** tab → **Find fresh news (daily)** (left sidebar).
2. **Run workflow** → **Run workflow**.

A minute later, check the **Issues** tab. Any stories it found are waiting there
for a thumbs-up. See **POSTING.md** for how to approve them.

---

## You're done

Hand your team **POSTING.md** — it's written for them, no technical background
needed. From now on:

- A staffer posts to the blog by filling in a form. It appears on its own.
- Anyone can submit a news link; a staffer approves it with one click.
- Each morning the robot suggests fresh, positive news for a staffer to approve.

You don't have to do anything for any of it.
