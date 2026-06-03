# axios

`createArgusHttpsProxyAgent()` builds an `HttpsProxyAgent`; pass it to axios with `proxy: false`.

```ts
import axios from "axios";
import { loadEnv, createArgusHttpsProxyAgent } from "@useargus/node";

await loadEnv();

const agent = await createArgusHttpsProxyAgent();
const client = axios.create({
  httpsAgent: agent,
  httpAgent: agent,
  proxy: false,
});

await client.get("https://api.anthropic.com/v1/models", { headers: { ... } });
```

Requires `https-proxy-agent` in your app's dependencies.

## `argusAxiosClientConfig()`

Returns:

| Field | Value |
| ----- | ----- |
| `proxyUrl` | Full proxy URL with token |
| `caPath` | Argus CA bundle path |
| `proxy` | `false` (use agent, not axios built-in proxy) |

Manual wiring:

```ts
import fs from "node:fs";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { loadEnv, argusAxiosClientConfig } from "@useargus/node";

await loadEnv();

const cfg = await argusAxiosClientConfig();
const agent = new HttpsProxyAgent(cfg.proxyUrl, {
  ca: fs.readFileSync(cfg.caPath),
});
const client = axios.create({ httpsAgent: agent, httpAgent: agent, proxy: cfg.proxy });
```
