# undici

`argusUndiciClientConfig()` returns plain options; `createArgusUndiciDispatcher()` builds a `ProxyAgent` for you.

## `createArgusUndiciDispatcher()`

```ts
import { loadEnv, createArgusUndiciDispatcher } from "@useargus/node";

await loadEnv();

const dispatcher = await createArgusUndiciDispatcher();
await fetch(url, { dispatcher, headers: { ... } });
```

Requires `undici` in your app's dependencies.

## `argusUndiciClientConfig()`

Returns:

| Field | Value |
| ----- | ----- |
| `uri` | Connect URI (`http://127.0.0.1:<port>`) |
| `token` | `Proxy-Authorization` value (`Basic …`) |
| `caPath` | Path to Argus CA bundle |

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

`argusFetchClientConfig()` wraps `{ undici: await argusUndiciClientConfig() }` for fetch-specific naming.
