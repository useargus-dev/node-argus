# Native fetch

Simplest path: `createArgusUndiciDispatcher()` when `undici` is installed in your app.

```ts
import { loadEnv, createArgusUndiciDispatcher } from "@useargus/node";

await loadEnv();

const dispatcher = await createArgusUndiciDispatcher();

await fetch("https://api.anthropic.com/v1/messages", {
  dispatcher,
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 64, messages: [...] }),
});
```

## Manual wiring

If you prefer to construct `ProxyAgent` yourself:

```ts
import fs from "node:fs";
import { ProxyAgent } from "undici";
import { loadEnv, argusUndiciClientConfig } from "@useargus/node";

await loadEnv();

const cfg = await argusUndiciClientConfig();
const dispatcher = new ProxyAgent({
  uri: cfg.uri,
  token: cfg.token,
  requestTls: { ca: fs.readFileSync(cfg.caPath) },
});
```

See [undici.md](./undici.md) for config field details.
