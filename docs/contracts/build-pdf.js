#!/usr/bin/env node
/* Renders sow-hulsey-for-house.html to a print-ready PDF.
   Usage:  node docs/contracts/build-pdf.js
   Requires playwright and a Chromium build. */
const path = require("path");
const { chromium } = require(process.env.PW || "playwright");

const DIR = __dirname;
const SRC = path.join(DIR, "sow-hulsey-for-house.html");
const OUT = path.join(DIR, "Built-By-Hodges_SOW_Hulsey-for-House.pdf");

const FOOT = `
<div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#7A8794;
            padding:0 0.8in;display:flex;justify-content:space-between;align-items:center;">
  <span>Statement of Work BBH-2026-001 &middot; Built By Hodges &middot; Confidential</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME ? { executablePath: process.env.CHROME } : {}
  );
  const page = await browser.newPage();
  await page.goto("file://" + SRC, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: OUT,
    format: "Letter",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: FOOT,
    margin: { top: "0.85in", bottom: "0.95in", left: "0.8in", right: "0.8in" },
  });
  await browser.close();
  console.log("Wrote " + OUT);
})();
