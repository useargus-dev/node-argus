import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type { ProxyConfig } from "../ipc/client.js";
import { proxyUrl, requireProxyConfig } from "./config.js";
import { getArgusProxyDetailed } from "./detailed.js";

type ProxyInput = ProxyConfig | undefined;

async function resolveDetailed(proxy?: ProxyInput) {
  return getArgusProxyDetailed(proxy);
}

export type ArgusUndiciClientConfig = {
  uri: string;
  token: string;
  caPath: string;
};

export type ArgusFetchClientConfig = {
  undici: ArgusUndiciClientConfig;
};

export type ArgusAxiosClientConfig = {
  proxyUrl: string;
  caPath: string;
  proxy: false;
};

export type ArgusHttpsClientConfig = {
  proxyUrl: string;
  caPath: string;
};

/** Plain options for `undici.ProxyAgent` / native `fetch` dispatcher. */
export async function argusUndiciClientConfig(
  proxy?: ProxyInput,
): Promise<ArgusUndiciClientConfig> {
  const d = await resolveDetailed(proxy);
  return {
    uri: d.connectUri,
    token: d.proxyAuthorization,
    caPath: d.caBundlePath,
  };
}

/** Native fetch wiring via undici dispatcher options. */
export async function argusFetchClientConfig(
  proxy?: ProxyInput,
): Promise<ArgusFetchClientConfig> {
  return { undici: await argusUndiciClientConfig(proxy) };
}

/** Plain options for `https-proxy-agent` + axios. */
export async function argusAxiosClientConfig(
  proxy?: ProxyInput,
): Promise<ArgusAxiosClientConfig> {
  const d = await resolveDetailed(proxy);
  return {
    proxyUrl: d.url,
    caPath: d.caBundlePath,
    proxy: false,
  };
}

/** Plain options for `node:https` via `https-proxy-agent`. */
export async function argusHttpsClientConfig(
  proxy?: ProxyInput,
): Promise<ArgusHttpsClientConfig> {
  const d = await resolveDetailed(proxy);
  return {
    proxyUrl: d.url,
    caPath: d.caBundlePath,
  };
}

let undiciRequire: ReturnType<typeof createRequire> | null = null;

function getRequire(): ReturnType<typeof createRequire> {
  if (!undiciRequire) {
    const filename =
      typeof __filename !== "undefined"
        ? __filename
        : fileURLToPath(import.meta.url);
    undiciRequire = createRequire(filename);
  }
  return undiciRequire;
}

/** Build an undici `ProxyAgent` (requires `undici` installed in your app). */
export async function createArgusUndiciDispatcher(
  proxy?: ProxyInput,
): Promise<unknown> {
  const cfg = await argusUndiciClientConfig(proxy);
  const { ProxyAgent } = getRequire()("undici") as {
    ProxyAgent: new (opts: {
      uri: string;
      token: string;
      requestTls: { ca: Buffer };
    }) => unknown;
  };
  const d = await resolveDetailed(proxy);
  return new ProxyAgent({
    uri: cfg.uri,
    token: cfg.token,
    requestTls: { ca: d.ca },
  });
}

/** Build `https-proxy-agent` for axios / node:https (requires package in your app). */
export async function createArgusHttpsProxyAgent(
  proxy?: ProxyInput,
): Promise<unknown> {
  const cfg = await argusHttpsClientConfig(proxy);
  const d = await resolveDetailed(proxy);
  const { HttpsProxyAgent } = getRequire()("https-proxy-agent") as {
    HttpsProxyAgent: new (
      url: string,
      opts: { ca: Buffer },
    ) => unknown;
  };
  return new HttpsProxyAgent(cfg.proxyUrl, { ca: d.ca });
}

export type ArgusAnthropicClientConfig = {
  fetchOptions: { dispatcher: unknown };
};

export type ArgusLangChainAnthropicClientConfig = {
  clientOptions: ArgusAnthropicClientConfig;
};

export type ArgusAxiosCreateConfig = {
  httpsAgent: unknown;
  httpAgent: unknown;
  proxy: false;
};

/** Options for native `fetch` (`dispatcher`). */
export async function argusFetchConfig(
  proxy?: ProxyInput,
): Promise<{ dispatcher: unknown }> {
  return { dispatcher: await createArgusUndiciDispatcher(proxy) };
}

/** Options for `@anthropic-ai/sdk` (`fetchOptions.dispatcher`). */
export async function argusAnthropicClientConfig(
  proxy?: ProxyInput,
): Promise<ArgusAnthropicClientConfig> {
  return {
    fetchOptions: { dispatcher: await createArgusUndiciDispatcher(proxy) },
  };
}

/** Options for `@langchain/anthropic` `ChatAnthropic` (`clientOptions`). */
export async function argusLangChainAnthropicClientConfig(
  proxy?: ProxyInput,
): Promise<ArgusLangChainAnthropicClientConfig> {
  return {
    clientOptions: await argusAnthropicClientConfig(proxy),
  };
}

/** Options for `axios.create()` (`httpsAgent`, `httpAgent`, `proxy: false`). */
export async function argusAxiosCreateConfig(
  proxy?: ProxyInput,
): Promise<ArgusAxiosCreateConfig> {
  const agent = await createArgusHttpsProxyAgent(proxy);
  return {
    httpsAgent: agent,
    httpAgent: agent,
    proxy: false,
  };
}
