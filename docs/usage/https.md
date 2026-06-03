# node:https

`createArgusHttpsProxyAgent()` returns an agent for `https.get` / `https.request`.

```ts
import https from "node:https";
import { loadEnv, createArgusHttpsProxyAgent } from "@useargus/node";

await loadEnv();

const agent = await createArgusHttpsProxyAgent();

https.get(
  "https://api.anthropic.com/v1/models",
  { agent, headers: { "x-api-key": process.env.ANTHROPIC_API_KEY! } },
  (res) => { /* ... */ },
);
```

Requires `https-proxy-agent` in your app's dependencies.

## `argusHttpsClientConfig()`

Returns `{ proxyUrl, caPath }` for manual `HttpsProxyAgent` construction. See [axios.md](./axios.md) for the manual pattern.
