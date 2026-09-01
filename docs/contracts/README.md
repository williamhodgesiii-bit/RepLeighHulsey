# Contracts

Business paperwork for this project. **Not part of the website.**

`/.vercelignore` excludes this whole `docs/` directory from deployment. That
matters: `vercel.json` sets `outputDirectory: "."`, so anything committed
outside the ignore list is served publicly from the live domain. Do not move
these files out of `docs/`.

## Files

| File | What it is |
| --- | --- |
| `sow-hulsey-for-house.html` | Source of the Statement of Work. Edit this, not the PDF. |
| `Built-By-Hodges_SOW_Hulsey-for-House.pdf` | The signable PDF sent to the client. |
| `build-pdf.js` | Rebuilds the PDF from the HTML. |
| `assets/bbh-mark.svg` | Built By Hodges mark, vector. |

## Rebuilding the PDF

```
npm i -D playwright && npx playwright install chromium
node docs/contracts/build-pdf.js
```

If Chromium is already on the machine, point at it instead of installing:

```
CHROME=/path/to/chrome node docs/contracts/build-pdf.js
```

The page footer, margins and Letter sizing are set in `build-pdf.js`; everything
else is CSS at the top of the HTML.

## Before sending

Fill in or confirm:

- **Effective date** on the cover.
- **Client legal entity name and billing address** — Section 1. Jake Rasmussen
  is the contact, but the entity that signs and pays has not been identified.
  It is either the campaign committee or Jake's own firm.
- **Hourly rate** ($85), **reactivation fee** ($250), **monthly edit allowance**
  (60 min) and **governing county** (Shelby) are defaults. Change them in the
  HTML and rebuild if they are wrong.
