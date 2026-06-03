# @useargus/node

Load environment variables from [Argus](https://github.com/useargus-dev) over local IPC, with `.env` fallback — similar to `dotenv`, but secrets come from your Argus bucket when the desktop app is running.

**v0.2** — returns Argus proxy connection details so you wire any HTTP library yourself.

## Requirements

- **Node.js** 18+
- **Argus desktop** signed in (IPC socket active)
- Project `.env` with `ARGUS_BUCKET_ID` and `ARGUS_BUCKET_TOKEN` (not the secret values themselves)

## Install

```bash
npm install @useargus/node
```

## Usage modes

### Without Argus Proxy

When proxy is **disabled** on the bucket, `loadEnv()` injects **real secret values** into `process.env`. Use fetch, axios, or any client normally:

```ts
import { loadEnv } from "@useargus/node";

await loadEnv();

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 64, messages: [...] }),
});
```

### With Argus Proxy enabled

When proxy is **enabled**, proxy mappings receive **`argus-proxy-*` placeholders**. Call `loadEnv()`, then wire your HTTP client with SDK helpers:

```ts
import { loadEnv, createArgusUndiciDispatcher } from "@useargus/node";

await loadEnv();
const dispatcher = await createArgusUndiciDispatcher();
await fetch(url, { dispatcher, headers: { ... } });
```

See [docs/usage](./docs/usage/README.md) for per-library guides (fetch, axios, Anthropic SDK, LangChain, …).

## Usage

Call `loadEnv()` **before** other modules read `process.env`:

### ESM

```ts
import { loadEnv } from "@useargus/node";

await loadEnv();
```

When the bucket has **Argus Proxy** enabled, wire **your HTTP client** after `loadEnv()` using the proxy helpers (see [docs/usage](./docs/usage/README.md)).

### CommonJS

```js
const { loadEnv } = require("@useargus/node");

await loadEnv();
```

### ESM preload (optional)

```bash
node --import @useargus/node/register ./app.js
```

CommonJS apps should call `await loadEnv()` in the entry file instead of using `register`.

## Project `.env`

```env
ARGUS_BUCKET_ID=550e8400-e29b-41d4-a716-446655440000
ARGUS_BUCKET_TOKEN=tok_...

# Optional local overrides (override bucket values for the same key)
# DATABASE_URL=postgresql://localhost/dev
```

Copy `.env.example` to get started.

## How it works

1. Parse `.env` (no side effects yet).
2. If `ARGUS_BUCKET_ID` and `ARGUS_BUCKET_TOKEN` are set (OS env or `.env`), connect to Argus over IPC and fetch mapped secrets.
3. Apply bucket values to `process.env`.
4. Apply `.env` — **duplicate keys use the `.env` value** (overrides bucket).
5. If bucket credentials are missing, load `.env` only (standard dotenv behavior).

### Argus app lock vs sign-out

| State                    | IPC                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| Signed in, idle app lock | Works — approval popup may appear for new clients                   |
| Signed out               | Returns `locked` — use `fallbackOnLocked: true` to load `.env` only |

Idle **app lock** does **not** block IPC. Only **sign-out** returns IPC `locked`.

### First run

The first time a process connects, Argus shows an **access approval** dialog (up to ~120s). Later requests use the grant TTL from bucket settings.

## API

### `loadEnv(options?)`

```ts
import { loadEnv } from "@useargus/node";

const result = await loadEnv({
  path: ".env", // default: .env in process.cwd()
  override: false, // dotenv-only mode: don't override existing OS env
  timeoutMs: 130_000, // IPC timeout
  fallbackOnLocked: false, // if signed out, load .env instead of throwing
});

// result.source === "bucket" | "dotenv"
// result.keys — names set (never values)
```

### Proxy wiring

After `loadEnv()`, use per-library **config** helpers and **builders**:

```ts
import { createArgusUndiciDispatcher, argusAxiosClientConfig } from "@useargus/node";

const dispatcher = await createArgusUndiciDispatcher();
```

| Kind | Functions |
| ---- | --------- |
| Config | `argusUndiciClientConfig()`, `argusFetchClientConfig()`, `argusAxiosClientConfig()`, `argusHttpsClientConfig()` |
| Builders | `createArgusUndiciDispatcher()`, `createArgusHttpsProxyAgent()` |

Per-library copy-paste examples: **[docs/usage/](./docs/usage/README.md)**

Install `undici` and/or `https-proxy-agent` in your app — not bundled in `@useargus/node`.

Low-level IPC fields remain on `requireProxyConfig()` / `getProxyConfig()`.

### `fetchBucketEnv(options)`

Lower-level IPC call if you only need the bucket map:

```ts
import { fetchBucketEnv } from "@useargus/node";

const env = await fetchBucketEnv({
  bucketId: process.env.ARGUS_BUCKET_ID!,
  clientToken: process.env.ARGUS_BUCKET_TOKEN!,
});
```

### Errors

All errors extend `ArgusError` with `.code` and optional `.requestId`. Use `instanceof` for handling:

| Error                       | Argus IPC                     | When                                              |
| --------------------------- | ----------------------------- | ------------------------------------------------- |
| `ArgusConnectionError`      | —                             | Socket/pipe missing, timeout, connection closed   |
| `ArgusLockedError`          | `status: locked`              | Argus signed out                                  |
| `ArgusApprovalDeniedError`  | `denied` + `APPROVAL_DENIED`  | User rejected client access                       |
| `ArgusApprovalTimeoutError` | `denied` + `APPROVAL_TIMEOUT` | Approval dialog timed out (120s)                  |
| `ArgusBucketNotFoundError`  | `BUCKET_NOT_FOUND`            | Wrong `ARGUS_BUCKET_ID`                           |
| `ArgusInvalidTokenError`    | `INVALID_TOKEN`               | Wrong or rotated `ARGUS_BUCKET_TOKEN`             |
| `ArgusBucketInactiveError`  | `BUCKET_INACTIVE`             | Bucket paused in Argus                            |
| `ArgusPeerResolveError`     | `PEER_RESOLVE`                | Argus could not identify this process             |
| `ArgusProxyError`           | `PROXY_ERROR`                 | Proxy enabled but misconfigured                   |
| `ArgusInvalidRequestError`  | `INVALID_REQUEST`             | Malformed IPC request                             |
| `ArgusInvalidResponseError` | —                             | Unexpected Argus response                         |
| `ArgusConfigureError`       | —                             | Proxy unavailable or disabled for bucket          |
| `ArgusError`                | other `error` codes           | `DB_ERROR`, `INTERNAL_ERROR`, etc.                |

## Proxy cookbook

Call `await loadEnv()` first in every example. Full guides: **[docs/usage/](./docs/usage/README.md)**

### Native fetch

```ts
import { loadEnv, createArgusUndiciDispatcher } from "@useargus/node";

await loadEnv();
const dispatcher = await createArgusUndiciDispatcher();
await fetch("https://api.anthropic.com/v1/models", { dispatcher, headers: { ... } });
```

### axios

```ts
import axios from "axios";
import { loadEnv, createArgusHttpsProxyAgent } from "@useargus/node";

await loadEnv();
const agent = await createArgusHttpsProxyAgent();
const client = axios.create({ httpsAgent: agent, httpAgent: agent, proxy: false });
```

### Other libraries

See [docs/usage/](./docs/usage/README.md) for undici, node:https, Anthropic SDK, and LangChain.

## Package layout

- `src/env/load.ts` — `loadEnv`
- `src/proxy/config.ts` — `getProxyConfig`, `requireProxyConfig`, `proxyUrl`
- `src/proxy/wiring.ts` — per-library proxy config and builders
- `src/ipc/client.ts` — IPC client, `ProxyConfig`
- `src/errors.ts` — error types

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

## Publish

Publishing is **manual** via GitHub Actions (adding `NPM_TOKEN` alone does not publish).

1. Add repository secret **`NPM_TOKEN`** (npm access token with publish rights).
2. Go to **Actions → Publish to npm → Run workflow**.
3. Enter the version (e.g. `0.2.0` or `v0.2.0`).

Scoped packages require `--access public` on first publish.

## License

MIT
