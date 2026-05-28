# @useargus/node

Load environment variables from [Argus](https://github.com/useargus-dev) over local IPC, with `.env` fallback — similar to `dotenv`, but secrets come from your Argus bucket when the desktop app is running.

## Requirements

- **Node.js** 18+
- **Argus desktop** signed in (IPC socket active)
- Project `.env` with `ARGUS_BUCKET_ID` and `ARGUS_BUCKET_TOKEN` (not the secret values themselves)

## Install

```bash
npm install @useargus/node
```

## Usage

Call `loadEnv()` **before** other modules read `process.env`:

### ESM

```ts
import { loadEnv } from "@useargus/node";

await loadEnv();
```

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

| State | IPC |
|--------|-----|
| Signed in, idle app lock | Works — approval popup may appear for new clients |
| Signed out | Returns `locked` — use `fallbackOnLocked: true` to load `.env` only |

Idle **app lock** does **not** block IPC. Only **sign-out** returns IPC `locked`.

### First run

The first time a process connects, Argus shows an **access approval** dialog (up to ~120s). Later requests use the grant TTL from bucket settings.

## API

### `loadEnv(options?)`

```ts
import { loadEnv } from "@useargus/node";

const result = await loadEnv({
  path: ".env",              // default: .env in process.cwd()
  override: false,           // dotenv-only mode: don't override existing OS env
  timeoutMs: 130_000,        // IPC timeout
  fallbackOnLocked: false,   // if signed out, load .env instead of throwing
});

// result.source === "bucket" | "dotenv"
// result.keys — names set (never values)
```

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

| Error | When |
|--------|------|
| `ArgusConnectionError` | Socket missing, Argus not running |
| `ArgusLockedError` | Argus signed out (`status: locked`) |
| `ArgusDeniedError` | User denied or approval timed out |
| `ArgusError` | Invalid token, bad request, etc. |

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

## License

MIT
