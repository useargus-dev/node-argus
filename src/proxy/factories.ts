import fs from "node:fs";

import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

import type { ProxyConfig } from "../ipc/client.js";
import { requireProxyConfig, proxyUrl } from "./config.js";
import { createUndiciProxyAgentFromUrl } from "./undici.js";

export type ProxyAgents = {
  httpAgent: HttpProxyAgent<string>;
  httpsAgent: HttpsProxyAgent<string>;
  caBundlePath: string;
};

function readCa(proxy: ProxyConfig): Buffer {
  return fs.readFileSync(proxy.caBundlePath);
}

function buildAgents(proxy: ProxyConfig): ProxyAgents {
  const url = proxyUrl(proxy);
  const ca = readCa(proxy);
  return {
    httpAgent: new HttpProxyAgent(url),
    httpsAgent: new HttpsProxyAgent(url, { ca }),
    caBundlePath: proxy.caBundlePath,
  };
}

/** HTTP(S) proxy agents with Argus MITM CA trust. Call after `loadEnv()`. */
export async function createProxyAgents(
  proxy?: ProxyConfig,
): Promise<ProxyAgents> {
  return buildAgents(proxy ?? (await requireProxyConfig()));
}

/** `httpAgent` for `@anthropic-ai/sdk` / LangChain (`new Anthropic({ httpAgent })`). */
export async function anthropicHttpAgent(
  proxy?: ProxyConfig,
): Promise<HttpsProxyAgent<string>> {
  return (await createProxyAgents(proxy)).httpsAgent;
}

export type FetchInitOptions = {
  dispatcher: unknown;
};

/** Options for `fetch(url, { ...fetchOptions() })` — no global undici dispatcher. */
export async function fetchOptions(
  proxy?: ProxyConfig,
): Promise<FetchInitOptions> {
  const cfg = proxy ?? (await requireProxyConfig());
  return {
    dispatcher: createUndiciProxyAgentFromUrl(
      proxyUrl(cfg),
      cfg.caBundlePath,
    ),
  };
}

export type AxiosLike = {
  defaults: { httpsAgent?: unknown; httpAgent?: unknown; proxy?: unknown };
  interceptors: unknown;
};

function isAxiosInstance(client: unknown): client is AxiosLike {
  return (
    typeof client === "object" &&
    client !== null &&
    "defaults" in client &&
    "interceptors" in client
  );
}

/** Wire an axios instance for Argus proxy (mutates `defaults`; returns same instance). */
export async function configureAxios<T extends AxiosLike>(
  client: T,
  proxy?: ProxyConfig,
): Promise<T> {
  const { httpAgent, httpsAgent } = await createProxyAgents(proxy);
  client.defaults.httpsAgent = httpsAgent;
  client.defaults.httpAgent = httpAgent;
  client.defaults.proxy = false;
  return client;
}

/** Create axios defaults object (`axios.create({ ...await axiosDefaults() })`). */
export async function axiosDefaults(
  proxy?: ProxyConfig,
): Promise<{ httpsAgent: HttpsProxyAgent<string>; httpAgent: HttpProxyAgent<string>; proxy: false }> {
  const { httpAgent, httpsAgent } = await createProxyAgents(proxy);
  return { httpsAgent, httpAgent, proxy: false };
}

export async function createUndiciProxyAgent(
  proxy?: ProxyConfig,
): Promise<unknown> {
  const cfg = proxy ?? (await requireProxyConfig());
  return createUndiciProxyAgentFromUrl(proxyUrl(cfg), cfg.caBundlePath);
}

/** Plain `fetch` init object using `httpsAgent` (node-fetch / legacy patterns). */
export async function fetchAgentOptions(
  proxy?: ProxyConfig,
): Promise<{ agent: HttpsProxyAgent<string> }> {
  const { httpsAgent } = await createProxyAgents(proxy);
  return { agent: httpsAgent };
}

/** Returns a configured `https.Agent` (HttpsProxyAgent). */
export async function createHttpsAgent(
  proxy?: ProxyConfig,
): Promise<HttpsProxyAgent<string>> {
  return (await createProxyAgents(proxy)).httpsAgent;
}

export { isAxiosInstance };
