# Proxy wiring (Node.js)

When **Argus Proxy** is enabled on your bucket, call `await loadEnv()` first. Env vars for proxy-enabled mappings hold `argus-proxy-*` placeholders — not real API keys. Wire your HTTP client using the helpers below.

## Helpers

| Kind | What | Functions |
| ---- | ---- | --------- |
| **Config** | Plain options for a specific library | `argusUndiciClientConfig()`, `argusFetchClientConfig()`, `argusAxiosClientConfig()`, `argusHttpsClientConfig()` |
| **Builders** | Ready-built agents (require deps in your app) | `createArgusUndiciDispatcher()`, `createArgusHttpsProxyAgent()` |

Low-level IPC fields (`httpProxy`, `caBundlePath`, …) remain on `requireProxyConfig()` / `getProxyConfig()`.

Install proxy agents in **your app** — `@useargus/node` does not bundle `undici` or `https-proxy-agent`.

## Per-library guides

| Library | Guide |
| ------- | ----- |
| [Native fetch](./fetch.md) | builder (or config + manual `ProxyAgent`) |
| [undici](./undici.md) | config + builder |
| [axios](./axios.md) | config + builder |
| [node:https](./https.md) | config + builder |
| [Anthropic SDK](./anthropic.md) | via undici dispatcher |
| [LangChain](./langchain.md) | via undici dispatcher |

## Prerequisites

Every example assumes:

```ts
import { loadEnv } from "@useargus/node";

await loadEnv();
```
