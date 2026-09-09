/* ==========================================================================
   api/github-auth.js — optional one-click sign-in for the website editor.

   Without this file the editor still works: a staffer pastes a GitHub access
   key once and the browser remembers it. This turns that into a "Sign in with
   GitHub" button instead, which is a great deal friendlier for people who have
   never seen a token in their lives.

   It only runs on a host that executes serverless functions (Vercel, Netlify
   with a redirect). On GitHub Pages it is simply never called, and the editor
   falls back to the key flow on its own.

   To switch it on:
     1. github.com/settings/developers -> New OAuth App
        Homepage:      https://hulseyforhouse.com
        Callback URL:  https://hulseyforhouse.com/api/github-auth
     2. In the host's project settings add two environment variables:
        GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
     3. Redeploy. The editor shows the button by itself.

   No dependencies, same as the rest of this project.
   ========================================================================== */

"use strict";

const AUTHORIZE = "https://github.com/login/oauth/authorize";
const TOKEN = "https://github.com/login/oauth/access_token";
const SCOPE = "repo";
const COOKIE = "hfh_oauth_state";

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const hit = raw.split(";").map((c) => c.trim()).filter((c) => c.indexOf(name + "=") === 0)[0];
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}

function origin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return proto + "://" + host;
}

module.exports = async function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
  const url = new URL(req.url, origin(req));
  const params = url.searchParams;

  // The editor asks, on load, whether this is worth offering.
  if (params.get("probe")) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: true, configured: !!(clientId && clientSecret) }));
    return;
  }

  if (!clientId || !clientSecret) {
    res.statusCode = 501;
    res.end("Sign-in is not configured. See the notes at the top of api/github-auth.js.");
    return;
  }

  // Step one: send them to GitHub, remembering a one-time value so the reply
  // can be shown to be an answer to this request and not somebody else's.
  if (params.get("start")) {
    const state = require("crypto").randomBytes(16).toString("hex");
    res.setHeader("Set-Cookie",
      COOKIE + "=" + state + "; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure");
    res.statusCode = 302;
    res.setHeader("Location", AUTHORIZE +
      "?client_id=" + encodeURIComponent(clientId) +
      "&scope=" + encodeURIComponent(SCOPE) +
      "&state=" + state +
      "&redirect_uri=" + encodeURIComponent(origin(req) + "/api/github-auth"));
    res.end();
    return;
  }

  // Step two: GitHub sends them back with a code to swap for a token.
  const code = params.get("code");
  if (!code) {
    res.statusCode = 400;
    res.end("Nothing to do.");
    return;
  }
  if (!params.get("state") || params.get("state") !== readCookie(req, COOKIE)) {
    res.statusCode = 400;
    res.end("That sign-in link has expired. Please start again from the editor.");
    return;
  }

  try {
    const reply = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: origin(req) + "/api/github-auth",
      }),
    });
    const data = await reply.json();
    if (!data.access_token) throw new Error(data.error_description || "GitHub declined the sign-in.");

    // The token goes back in the URL fragment, which browsers never send to a
    // server. The editor reads it, stores it, and clears the address bar.
    res.setHeader("Set-Cookie", COOKIE + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
    res.statusCode = 302;
    res.setHeader("Location", "/admin/#token=" + encodeURIComponent(data.access_token));
    res.end();
  } catch (err) {
    res.statusCode = 502;
    res.end("Sign-in failed: " + err.message);
  }
};
