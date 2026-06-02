# @useargus/node

Load environment variables from [Argus](https://github.com/useargus-dev) over local IPC, with `.env` fallback — similar to `dotenv`, but secrets come from your Argus bucket when the desktop app is running.

**v0.2** — supports Argus Proxy factories so real API keys never need to sit in `process.env`.

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

When proxy is **enabled**, proxy mappings receive **`argus-proxy-*` placeholders**. Call `loadEnv()` then wire **one factory per HTTP stack**:

```ts
import { loadEnv, fetchOptions } from "@useargus/node";

await loadEnv();
const init = await fetchOptions();
await fetch("https://api.anthropic.com/v1/messages", { ...init, method: "POST", headers: { ... } });
```

See [Proxy cookbook](#proxy-cookbook) for Anthropic SDK, axios, undici, and LangChain.

## Usage

Call `loadEnv()` **before** other modules read `process.env`:

### ESM

```ts
import { loadEnv } from "@useargus/node";

await loadEnv();
```

When the bucket has **Argus Proxy** enabled, wire **your HTTP client explicitly** after `loadEnv()` (see [Usage modes](#usage-modes) and [Proxy cookbook](#proxy-cookbook)).

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

### Proxy factories (preferred)

After `loadEnv()`, use one factory per HTTP library — **no global monkey patches**:

| Factory                                        | Use with                                            |
| ---------------------------------------------- | --------------------------------------------------- |
| `createProxyAgents()`                          | Low-level `{ httpAgent, httpsAgent, caBundlePath }` |
| `anthropicHttpAgent()`                         | `@anthropic-ai/sdk`, LangChain                      |
| `fetchOptions()`                               | Native `fetch()` / undici (`{ dispatcher }`)        |
| `axiosDefaults()` / `configureAxios(instance)` | axios                                               |
| `createHttpsAgent()`                           | `node:https`                                        |
| `createUndiciProxyAgent()`                     | undici `Client` / `Pool`                            |

### `configure(client?)` (deprecated)

`configure()` without arguments is **deprecated** (warns; removed next major). Pass a client or use factories above.

### `loadProxies()` (deprecated)

Use `fetchOptions()` instead.

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
| `ArgusConfigureError`       | —                             | `configure()` preconditions or unsupported client |
| `ArgusError`                | other `error` codes           | `DB_ERROR`, `INTERNAL_ERROR`, etc.                |

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
3. Enter the version (e.g. `0.1.0` or `v0.1.0`).

The workflow runs CI, sets `package.json` version, publishes to npm, tags `v<version>`, and creates a GitHub release.

### Publish locally (optional)

```bash
npm login
npm run ci
npm version 0.1.0 --no-git-tag-version
npm publish --access public
```

Scoped packages require `--access public` on first publish.

## Proxy cookbook

Call `await loadEnv()` first in every example.

### Native `fetch`

```ts
import { loadEnv, fetchOptions } from "@useargus/node";

await loadEnv();
const fetchInit = await fetchOptions();
const res = await fetch("https://api.anthropic.com/v1/models", {
  ...fetchInit,
  headers: { "x-api-key": process.env.ANTHROPIC_API_KEY! },
});
```

### `@anthropic-ai/sdk` (≥ 0.65)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, fetchOptions } from "@useargus/node";

await loadEnv();
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  fetchOptions: await fetchOptions(),
});
```

### LangChain (`@langchain/anthropic`)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { ChatAnthropic } from "@langchain/anthropic";
import { loadEnv, fetchOptions } from "@useargus/node";

await loadEnv();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  fetchOptions: await fetchOptions(),
});
const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5",
  client: anthropic,
});
```

### axios

```ts
import axios from "axios";
import { loadEnv, axiosDefaults } from "@useargus/node";

await loadEnv();
const client = axios.create({ ...(await axiosDefaults()) });
```

### undici

```ts
import { fetch } from "undici";
import { loadEnv, fetchOptions } from "@useargus/node";

await loadEnv();
const { dispatcher } = await fetchOptions();
await fetch("https://api.anthropic.com/v1/models", { dispatcher });
```

### `node:https`

```ts
import https from "node:https";
import { loadEnv, createHttpsAgent } from "@useargus/node";

await loadEnv();
const agent = await createHttpsAgent();
https.get("https://api.anthropic.com/v1/models", { agent, ... });
```

### BAML / custom clients

Pass `httpAgent` or `dispatcher` from `anthropicHttpAgent()` / `fetchOptions()` into the client your stack constructs.

## Package layout

Internal modules (public exports unchanged):

- `src/env/load.ts` — `loadEnv`
- `src/proxy/factories.ts` — explicit proxy wiring
- `src/proxy/config.ts` — `getProxyConfig`, `requireProxyConfig`
- `src/ipc/client.ts` — IPC client
- `src/errors.ts` — error types

## License

MIT
