Below is a pattern that Discord themselves recommend for “first-party” projects like yours.  It requires **one short OAuth2 sign-in the first time a member installs your browser extension**; after that, every request the extension makes to your HTTP API is automatically authenticated with a signed JWT that your back-end knows how to verify.

---

## 1.   Create a separate **OAuth2 application**

1. In **discord.com/developers → Applications** click **“New Application”**
   (you can reuse the bot’s application, but keeping the OAuth client isolated is cleaner).
2. Under **OAuth2 → General**

   * add **`https://api.your-domain.xyz/auth/callback`** as a *redirect URI*.
   * keep **Client ID** public; keep **Client Secret** private.

---

## 2.   Browser-extension sign-in (PKCE flow, no secret in the client)

### a) Kick off login

```ts
// content or background script
const clientId = "<your-client-id>";
const redirect = encodeURIComponent(
  "https://api.your-domain.xyz/auth/callback"
);
const scopes   = "identify";           // only need user-id
const state    = crypto.randomUUID();  // CSRF protection

// PKCE helper
function genCodeVerifier() {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...buf))
         .replace(/[\+\/=]/g, "").substring(0, 43);
}
const code_verifier  = genCodeVerifier();
const code_challenge = await sha256Base64Url(code_verifier); // helper below

chrome.storage.local.set({state, code_verifier});  // we’ll need them later

const url =
  `https://discord.com/api/oauth2/authorize?` +
  `response_type=code&client_id=${clientId}` +
  `&redirect_uri=${redirect}` +
  `&scope=${scopes}` +
  `&state=${state}` +
  `&code_challenge=${code_challenge}` +
  `&code_challenge_method=S256`;

chrome.identity.launchWebAuthFlow({url, interactive: true});
```

`sha256Base64Url` is a 10-line helper that hashes `code_verifier` and base64url-encodes it.

### b) Your **/auth/callback** endpoint

```ts
// Express-style pseudo-code
app.get("/auth/callback", async (req, res) => {
  const { code, state: rState } = req.query;

  // 1. CSRF check
  const { state, code_verifier } = await redis.get("pkce:" + rState);
  if (!state || state !== rState) return res.status(400).send("Bad state");

  // 2. Exchange code → access_token
  const tokenRes = await axios.post(
    "https://discord.com/api/oauth2/token",
    qs.stringify({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier
    }),
    { headers: {"Content-Type": "application/x-www-form-urlencoded"} }
  );

  const { access_token } = tokenRes.data;

  // 3. Get the user’s id
  const user = await axios.get(
    "https://discord.com/api/users/@me",
    { headers: {Authorization: `Bearer ${access_token}`} }
  );

  const userId = user.data.id;

  // 4. Verify they really belong to your guild
  //    (no extra OAuth scope needed because the BOT can query guild members)
  const member = await discordBot.guilds.cache
    .get(YOUR_GUILD_ID)
    .members.fetch(userId)
    .catch(() => null);

  if (!member) return res.status(403).send("Not in guild");

  // 5. Create a session token (signed JWT)
  const jwt = jwtSign({ sub: userId }, SESSION_SECRET, { expiresIn: "12h" });

  // 6. Send it back to the extension
  res.set("Content-Type", "text/html").send(`
    <script>
      chrome.runtime.sendMessage({jwt: "${jwt}"});
      window.close();
    </script>
  `);
});
```

The browser extension receives the message, stores the JWT in `chrome.storage.local`, and from then on attaches it to every fetch:

```ts
const jwt = await getStoredJwt();
fetch("https://api.your-domain.xyz/messages?channel=123", {
  headers: {Authorization: `Bearer ${jwt}`}
});
```

---

## 3.   Protect every API route

```ts
// tiny Express middleware
function requireGuildMember(req, res, next) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") && auth.slice(7);

  try {
    const payload = jwtVerify(token, SESSION_SECRET);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({error: "signin required"});
  }
}
```

Because the JWT contains only a user-id and a 12-hour expiry, it’s cheap to verify.
If someone leaves the server during that window you can:

* either live-revoke (keep a “revoked-before” timestamp and embed `iat` in the JWT), or
* let the token expire naturally and rely on channel permissions to block new data from being cached.

---

## 4.   Why this is “simple” for members

* They click **“Log in with Discord”** once, approve the dialog they are used to, and are done.
* No passwords, no extra accounts, no role configuration.
* Your HTTP API never stores Discord access tokens; you only keep a lightweight, signed session JWT.

---

### Frequently asked questions

| Issue                                                                     | Quick answer                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Do we really need the `guilds` scope?**                                 | No. With only `identify`, your bot (which is already in the guild) can check membership via the *bot token* and ensure privacy without exposing extra data to the browser.                 |
| **Is PKCE required?**                                                     | Yes—browser extensions are public clients, so you cannot safely embed the client secret. PKCE removes that need.                                                                           |
| **What about Firefox/Edge?**                                              | The Web-Extension API’s `identity.launchWebAuthFlow` works in Chrome, Edge and Firefox. For Safari, use `browser.identity` polyfill or open a tab + `postMessage`.                         |
| **Can I skip OAuth and read the Discord user-token out of localStorage?** | Don’t.  Apart from being against Discord’s ToS, you’d be asking users to grant your extension blanket DOM access to *.discord.com*—a much bigger security risk than a normal OAuth dialog. |

---

## 5.   Putting it all together

```
┌───────────────┐        OAuth2 (PKCE)         ┌───────────────┐
│Browser ext.   │ ───────────────────────────► │ Discord OAuth │
└─────▲─────────┘   code + verifier            └─────▲─────────┘
      │ auth flow                             exchange │
      │  chrome.identity.launchWebAuthFlow            │
      │                                               ▼
┌─────┴─────────┐   POST /oauth2/token        ┌───────────────┐
│  Your API     │ ◄────────────────────────── │   Discord API │
│ /auth/callback│                             └───────────────┘
└─────▲─────────┘   verify guild, mint JWT
      │
      │       Authorization: Bearer <JWT>
      │
      ▼
┌───────────────┐
│ /messages ... │  ← all further requests; no Discord hit
└───────────────┘
```

This keeps the surface area tiny:

* **Only guild members can ever mint a JWT** (step 4).
* **Only requests with a valid JWT can hit your message cache** (middleware).
* Every moving piece (OAuth, PKCE, JWT) is a well-worn, audited standard.

Feel free to copy the snippets above into your codebase—they’re intentionally minimal so you can drop them into Express, Fastify, Flask, Go, etc. If you’d like sample production-grade code or help wiring `chrome.identity` in your specific extension setup, just let me know!
