import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

import { ArgusConfigureError } from "../errors.js";
import {
  applyProxyToProcessEnv,
  fetchBucketEnv,
  type ProxyConfig,
} from "../ipc/client.js";
import { applyUndiciGlobalProxy } from "./undici.js";
import { getCachedProxy, setCachedProxy } from "./state.js";

export type ConfigureResult = {
  proxyEnabled: boolean;
  globalsApplied: boolean;
  clientConfigured: boolean;
};

let globalsApplied = false;
let tlsPatched = false;
let agentsPatched = false;
let origCreateSecureContext: typeof tls.createSecureContext | null = null;
let argusCaPem: string | null = null;

const require = createRequire(
  typeof __filename !== "undefined"
    ? __filename
    : fileURLToPath(import.meta.url),
);

function bucketCredentials(): { bucketId?: string; token?: string } {
  return {
    bucketId: process.env.ARGUS_BUCKET_ID,
    token: process.env.ARGUS_BUCKET_TOKEN,
  };
}

async function resolveProxyConfig(): Promise<ProxyConfig | null> {
  const cached = getCachedProxy();
  if (cached) {
    return cached;
  }

  const { bucketId, token } = bucketCredentials();
  if (!bucketId || !token) {
    return null;
  }

  const result = await fetchBucketEnv({ bucketId, clientToken: token });
  setCachedProxy(result.proxy);
  return result.proxy;
}

function proxyUrl(proxy: ProxyConfig): string {
  return proxy.httpsProxy || proxy.httpProxy;
}

function patchTls(caBundlePath: string): void {
  if (tlsPatched) {
    return;
  }
  argusCaPem = fs.readFileSync(caBundlePath, "utf8");
  origCreateSecureContext = tls.createSecureContext;
  tls.createSecureContext = ((options: tls.SecureContextOptions = {}) => {
    const existing = options.ca
      ? Array.isArray(options.ca)
        ? options.ca
        : [options.ca]
      : [];
    return origCreateSecureContext!({
      ...options,
      ca: [...existing, argusCaPem!],
    });
  }) as typeof tls.createSecureContext;
  tlsPatched = true;
}

function patchGlobalAgents(proxy: ProxyConfig): void {
  if (agentsPatched) {
    return;
  }
  const url = proxyUrl(proxy);
  const ca = fs.readFileSync(proxy.caBundlePath);
  http.globalAgent = new HttpProxyAgent(url) as http.Agent;
  https.globalAgent = new HttpsProxyAgent(url, { ca }) as https.Agent;
  agentsPatched = true;
}

function applyGlobalProxy(proxy: ProxyConfig): void {
  if (!proxy.enabled) {
    throw new ArgusConfigureError(
      "Argus proxy is disabled for this bucket. Enable it in Argus bucket settings.",
    );
  }
  applyProxyToProcessEnv(proxy);
  patchTls(proxy.caBundlePath);
  patchGlobalAgents(proxy);
  if (!applyUndiciGlobalProxy()) {
    throw new ArgusConfigureError(
      "Could not configure undici ProxyAgent (missing proxy URL or ARGUS_BUCKET_TOKEN).",
    );
  }
  globalsApplied = true;
}

function isAxiosInstance(client: unknown): client is {
  defaults: { httpsAgent?: unknown; httpAgent?: unknown; proxy?: unknown };
} {
  return (
    typeof client === "object" &&
    client !== null &&
    "defaults" in client &&
    "interceptors" in client
  );
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as object).constructor === Object
  );
}

function isHttpsAgent(client: unknown): boolean {
  return client instanceof https.Agent;
}

function isUndiciClient(client: unknown): boolean {
  try {
    const undici = require("undici") as {
      Client: new (...args: unknown[]) => unknown;
      Pool: new (...args: unknown[]) => unknown;
    };
    return (
      client instanceof undici.Client || client instanceof undici.Pool
    );
  } catch {
    return false;
  }
}

function buildProxyAgents(proxy: ProxyConfig): {
  httpsAgent: HttpsProxyAgent<string>;
  httpAgent: HttpProxyAgent<string>;
} {
  const url = proxyUrl(proxy);
  const ca = fs.readFileSync(proxy.caBundlePath);
  return {
    httpsAgent: new HttpsProxyAgent(url, { ca }),
    httpAgent: new HttpProxyAgent(url),
  };
}

function configureClient(client: unknown, proxy: ProxyConfig): unknown {
  const { httpsAgent, httpAgent } = buildProxyAgents(proxy);

  if (isAxiosInstance(client)) {
    client.defaults.httpsAgent = httpsAgent;
    client.defaults.httpAgent = httpAgent;
    client.defaults.proxy = false;
    return client;
  }

  if (isHttpsAgent(client)) {
    return httpsAgent;
  }

  if (isUndiciClient(client)) {
    const { ProxyAgent } = require("undici") as {
      ProxyAgent: new (opts: {
        uri: string;
        token?: string;
        requestTls?: { ca: Buffer };
      }) => unknown;
    };
    const parsed = new URL(proxyUrl(proxy));
    const port =
      parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const uri = `${parsed.protocol}//${parsed.hostname}:${port}`;
    const user = parsed.username
      ? decodeURIComponent(parsed.username)
      : process.env.ARGUS_BUCKET_TOKEN ?? "";
    const pass = parsed.password ? decodeURIComponent(parsed.password) : "";
    const token = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
    return new ProxyAgent({
      uri,
      token: `Basic ${token}`,
      requestTls: { ca: fs.readFileSync(proxy.caBundlePath) },
    });
  }

  if (isPlainObject(client)) {
    return { ...client, agent: httpsAgent };
  }

  const name =
    client !== null && typeof client === "object" && "constructor" in client
      ? (client as { constructor: { name?: string } }).constructor?.name
      : typeof client;
  throw new ArgusConfigureError(
    `configure() does not support ${name ?? "unknown"}. ` +
      "Supported: axios instance, https.Agent, undici Client/Pool, fetch options object. " +
      "Call configure() with no arguments for global proxy patches only.",
  );
}

/**
 * Enable Argus HTTP proxy and MITM CA trust for this process.
 *
 * Call after `loadEnv()` when the bucket has proxy enabled.
 *
 * With no argument, applies global patches (env, http/https agents, tls, undici).
 * With a client argument, applies globals and returns a configured client.
 */
export async function configure(
  client?: unknown,
): Promise<ConfigureResult | unknown> {
  const proxy = await resolveProxyConfig();
  if (!proxy) {
    throw new ArgusConfigureError(
      "Argus proxy config is not available. Call loadEnv() first with valid " +
        "ARGUS_BUCKET_ID and ARGUS_BUCKET_TOKEN, or ensure Argus is signed in.",
    );
  }
  if (!proxy.enabled) {
    throw new ArgusConfigureError(
      "Argus proxy is disabled for this bucket. Enable 'Argus Proxy' in Argus " +
        "bucket settings, then call loadEnv() and configure() again.",
    );
  }

  applyGlobalProxy(proxy);

  if (client === undefined) {
    return {
      proxyEnabled: true,
      globalsApplied: globalsApplied,
      clientConfigured: false,
    } satisfies ConfigureResult;
  }

  return configureClient(client, proxy);
}
