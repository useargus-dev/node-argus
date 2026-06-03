# LangChain (@langchain/anthropic)

Use `argusLangChainAnthropicClientConfig()` — it wraps `argusAnthropicClientConfig()` as `clientOptions`.

```ts
import { ChatAnthropic } from "@langchain/anthropic";
import { argusLangChainAnthropicClientConfig, loadEnv } from "@useargus/node";

await loadEnv();

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY!,
  ...(await argusLangChainAnthropicClientConfig()),
});

const response = await llm.invoke("Reply with exactly the word: ok");
```

See [anthropic.md](./anthropic.md) for the underlying dispatcher wiring.
