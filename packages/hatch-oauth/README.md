# hatch-oauth

> Drop-in OAuth broker for MCP servers. Your users never paste a token, your tokens never leave your control.

[![npm](https://img.shields.io/npm/v/hatch-oauth.svg)](https://www.npmjs.com/package/hatch-oauth)

```bash
npm install hatch-oauth
```

## What it does

You ship an MCP server that talks to your API. Some endpoints need a logged-in user. Today that means asking users to paste a token into their Claude Desktop config — terrible UX, frequent support tickets, and tokens leaking through screenshots.

`hatch-oauth` puts **HatchMCP** in front of your auth as a token broker:

```
┌──────────────┐ hatch_token ┌─────────────┐    real token    ┌──────────────┐
│ Claude /     │ ─────────▶  │ HatchMCP    │ ─────────────▶   │ Your API     │
│ MCP server   │             │ (broker)    │                  │              │
└──────────────┘ ◀───────── ┘└─────────────┘ ◀─────────────── └──────────────┘
       ▲                          ▲
       │                          │
       │   "Connect" button       │ stores real token (AES-256-GCM at rest)
       │   one-click OAuth        │ encrypted, never re-sent to MCP client
       │                          │
       └──── user ────────────────┘
```

- **Users** click **Connect** once. No tokens to copy.
- **You** keep your existing auth (Supabase / JWT / whatever). One `npm install`, three lines of code.
- **HatchMCP** holds the token encrypted, exchanges it on every MCP tool call, logs every access, lets the user revoke from a dashboard.

## Three lines of code

```ts
import { HatchOAuth } from 'hatch-oauth'

const hatch = new HatchOAuth({
  clientId: process.env.HATCH_CLIENT_ID!,
  clientSecret: process.env.HATCH_CLIENT_SECRET!,
})

// After your user logs in successfully:
const { hatch_token } = await hatch.storeToken({
  user_id: session.user.id,
  real_token: session.access_token,
  expires_at: new Date(Date.now() + 60 * 60 * 1000),
})
```

That's it. Your MCP server uses the `hatch_token` instead of asking the user for credentials.

## Quickstart

### 1. Register your app on HatchMCP

```bash
curl -X POST https://hatchmcp.com/api/v1/oauth/register \
  -H "Authorization: Bearer <your-hatchmcp-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DevShowcase",
    "slug": "devshowcase",
    "callback_url": "https://devshowcase.com/auth/callback",
    "description": "Developer portfolio platform",
    "scopes": ["read your projects", "create posts on your behalf"]
  }'
```

Save the `client_id` and `client_secret` (shown **once**) in your env:

```bash
HATCH_CLIENT_ID=hco_a8f6cd…
HATCH_CLIENT_SECRET=hcs_9b4e21…
```

### 2. Install the package in your backend

```bash
npm install hatch-oauth
```

### 3. Wire it into your auth callback

```ts
// in your existing login / OAuth callback handler
import { HatchOAuth } from 'hatch-oauth'

const hatch = new HatchOAuth({
  clientId: process.env.HATCH_CLIENT_ID!,
  clientSecret: process.env.HATCH_CLIENT_SECRET!,
})

app.post('/auth/callback', async (req, res) => {
  // … your existing auth logic …
  const user = await yourAuth.verify(req)
  const realToken = await yourAuth.tokenFor(user)

  // ONE NEW CALL: hand the token to Hatch
  const { hatch_token } = await hatch.storeToken({
    user_id: user.id,
    real_token: realToken,
    expires_at: realToken.expires_at,
    state: req.query.hatch_state as string | undefined, // CSRF from Connect page
  })

  // Pass hatch_token back to the user's MCP installer (see Connect flow below)
  res.redirect(`https://hatchmcp.com/oauth/connect/devshowcase/complete?hatch_token=${hatch_token}`)
})
```

### 4. (Optional) Protect inbound MCP calls with the middleware

If your MCP tools call your own backend, gate those endpoints with the middleware. It validates the `Authorization: Hatch <token>` header, exchanges with the broker, and attaches `req.hatch` with the real user info:

```ts
app.use('/api/mcp', hatch.middleware())

app.get('/api/mcp/projects', (req, res) => {
  // req.hatch.real_token is the user's actual API token
  // req.hatch.user_id is whatever you passed to storeToken
  res.json({ user: req.hatch!.user_id, scopes: req.hatch!.scopes })
})
```

## API reference

### `new HatchOAuth(options)`

| Option | Type | Description |
|---|---|---|
| `clientId` | `string` | **Required.** From `/oauth/register`. |
| `clientSecret` | `string?` | Required for company-side ops (`storeToken`, `revoke({userId})`, `listSessions`). Omit on the MCP-server side. |
| `baseUrl` | `string?` | Default `https://hatchmcp.com`. |
| `timeoutMs` | `number?` | Per-request timeout. Default `15000`. |
| `tokenStore` | `TokenStore?` | Persists hatch_tokens by `user_id`. Default in-memory (dev only). |
| `debug` | `boolean \| function` | Log every request/response. |

### Methods

| Method | When you use it |
|---|---|
| `storeToken({ user_id, real_token, … })` | After your user logs in. Hands the real token to Hatch, gets back a `hatch_token`. |
| `getToken(userId)` | Need the real token for an outbound call. Looks up the hatch_token from the store, exchanges, returns the real token. Auto-rotates the hatch_token if near expiry. |
| `exchangeToken(hatchToken)` | MCP-server context. You hold a `hatch_token` in env; exchange it for a real token on each protected call. |
| `getConnectUrl({ redirectUri, state })` | Build the URL to send the user to (`hatchmcp.com/oauth/connect/<slug>?…`). |
| `getCompanyMetadata(slug)` | Public — pulls your app name, logo, scopes (for building a custom Connect screen). |
| `validateRequest(req)` | Pull a `hatch_token` from request headers and exchange it. Use this in non-Express handlers. |
| `middleware(opts?)` | Express middleware that does `validateRequest` + attaches `req.hatch`. |
| `revoke({ hatchToken })` / `revoke({ userId })` | Tear down a session. |
| `listSessions()` | List all your connected users. |

### `req.hatch` shape (after middleware)

```ts
interface ValidatedRequest {
  user_id: string             // whatever you passed to storeToken
  session_id: string          // Hatch's session uuid
  scopes: string[]            // what you stored
  metadata: Record<string, unknown>
  real_token: string          // upstream API token — use this to call your real API
}
```

## Errors

Every error is an `instanceof HatchOAuthError`. The most useful subclass to catch is `HatchOAuthReconnectRequired` — surface a reconnect URL to the user:

```ts
try {
  const token = await hatch.getToken(userId)
  // …
} catch (err) {
  if (err instanceof HatchOAuthReconnectRequired) {
    return res.status(401).json({
      error: 'Reconnect required',
      reconnect_url: hatch.getConnectUrl({ state: makeCsrf() }),
    })
  }
  throw err
}
```

Other subclasses: `HatchOAuthForbidden` (bad `client_secret`), `HatchOAuthRateLimited` (`retryAfter` available), `HatchOAuthNetworkError` (transient — retry), `HatchOAuthServerError` (5xx from broker).

## Token store

The default in-memory store is great for development and single-process dev servers. For production, plug in your DB:

```ts
import type { TokenStore } from 'hatch-oauth'
import { pool } from './db.js'

const pgTokenStore: TokenStore = {
  async get(userId) {
    const r = await pool.query(
      'SELECT hatch_token, expires_at, session_id FROM hatch_tokens WHERE user_id = $1',
      [userId]
    )
    return r.rows[0] ?? null
  },
  async set(userId, value) {
    await pool.query(
      `INSERT INTO hatch_tokens (user_id, hatch_token, expires_at, session_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET hatch_token = EXCLUDED.hatch_token,
             expires_at = EXCLUDED.expires_at,
             session_id = EXCLUDED.session_id`,
      [userId, value.hatch_token, value.expires_at, value.session_id]
    )
  },
  async delete(userId) {
    await pool.query('DELETE FROM hatch_tokens WHERE user_id = $1', [userId])
  },
}

const hatch = new HatchOAuth({ /* … */ tokenStore: pgTokenStore })
```

## MCP server side

Inside the generated MCP server, you don't need a store — the `hatch_token` is in `process.env.HATCH_TOKEN` and you exchange it per call:

```ts
import { HatchOAuth, HatchOAuthReconnectRequired } from 'hatch-oauth'

const hatch = new HatchOAuth({
  clientId: process.env.HATCH_CLIENT_ID!,
  // no clientSecret needed on the MCP side
})

async function callMyApi(toolName: string, path: string) {
  try {
    const { real_token } = await hatch.exchangeToken(
      process.env.HATCH_TOKEN!,
      { toolName }
    )
    return fetch(`https://devshowcase.com/api/${path}`, {
      headers: { Authorization: `Bearer ${real_token}` },
    })
  } catch (err) {
    if (err instanceof HatchOAuthReconnectRequired) {
      // Surface a clear "user needs to reconnect" message to Claude
      throw new Error(
        `User needs to reconnect: ${hatch.getConnectUrl()}`
      )
    }
    throw err
  }
}
```

## Security notes

- **Real tokens are AES-256-GCM encrypted at rest** — HatchMCP holds the ciphertext + IV per session.
- **`hatch_token` is a signed JWT** (HS256) with a session id; verify is constant-time, no DB hit needed before deciding it's malformed.
- **`client_secret` is bcrypt-hashed** server-side; plaintext is shown exactly once on register.
- **Every `/exchange` call is logged** — session id, company id, IP, user-agent, optional tool name. Visible to the company via `/sessions`.
- **Tokens rotate lazily** — within 7 days of expiry, `/exchange` returns a fresh `rotated_hatch_token`; the SDK persists it transparently.
- **Revocation is immediate** — the broker stops accepting the hatch_token within one DB write of the revoke call.

## What's not in 0.1

- **Automatic refresh of the upstream real token** — your backend handles refresh and re-calls `storeToken`. (Coming in 0.2.)
- **Per-tool scope policies** — current model is one scope set per session.
- **Hosted Connect page deeplink** that auto-injects `HATCH_TOKEN` into Claude Desktop config without copy-paste. The token currently lands on a "Save this in your MCP config" page after Connect; deeplink coming.

## Links

- Setup guide: https://github.com/hatchmcp/Hatch-mcp/blob/main/packages/hatch-oauth/README.md
- Issues: https://github.com/hatchmcp/Hatch-mcp/issues
- Dashboard: https://hatchmcp.com

## License

MIT
