# Anthropic SDK

Use `argusAnthropicClientConfig()` for `@anthropic-ai/sdk` (≥ 0.65) — it returns `fetchOptions.dispatcher` via undici.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { argusAnthropicClientConfig, loadEnv } from "@useargus/node";

await loadEnv();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  ...(await argusAnthropicClientConfig()),
});

const models = await client.models.list();
```

See [fetch.md](./fetch.md) for manual dispatcher wiring with `createArgusUndiciDispatcher()`.
