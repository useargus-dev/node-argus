import { createRequire } from "node:module";
import https from "node:https";
import { fileURLToPath } from "node:url";

import { ArgusConfigureError } from "../errors.js";
import type { ProxyConfig } from "../ipc/client.js";
import { requireProxyConfig } from "./config.js";
import {
  configureAxios,
  createProxyAgents,
  createUndiciProxyAgent,
  fetchAgentOptions,
  isAxiosInstance,
} from "./factories.js";

export type ConfigureResult = {
  proxyEnabled: boolean;
  globalsApplied: boolean;
  clientConfigured: boolean;
};

const DEPRECATION =
  "[@useargus/node] configure() with no arguments is deprecated and will be removed in the next major. " +
  "Use explicit factories instead: createProxyAgents(), anthropicHttpAgent(), fetchOptions(), " +
  "configureAxios(), axiosDefaults(). See README cookbook.";

const require = createRequire(
  typeof __filename !== "undefined"
    ? __filename
    : fileURLToPath(import.meta.url),
);

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

async function configureClient(
  client: unknown,
  proxy: ProxyConfig,
): Promise<unknown> {
  if (isAxiosInstance(client)) {
    return configureAxios(client, proxy);
  }

  if (isHttpsAgent(client)) {
    return (await createProxyAgents(proxy)).httpsAgent;
  }

  if (isUndiciClient(client)) {
    return createUndiciProxyAgent(proxy);
  }

  if (isPlainObject(client)) {
    return fetchAgentOptions(proxy);
  }

  const name =
    client !== null && typeof client === "object" && "constructor" in client
      ? (client as { constructor: { name?: string } }).constructor?.name
      : typeof client;
  throw new ArgusConfigureError(
    `configure(client) does not support ${name ?? "unknown"}. ` +
      "Use createProxyAgents(), anthropicHttpAgent(), fetchOptions(), or configureAxios(). " +
      "See README cookbook.",
  );
}

/**
 * @deprecated Pass an explicit client or use factory helpers (`createProxyAgents`, `fetchOptions`, …).
 *
 * With a client argument, configures that client only (no global patches).
 * With no argument, logs a deprecation warning and returns metadata only.
 */
export async function configure(
  client?: unknown,
): Promise<ConfigureResult | unknown> {
  const proxy = await requireProxyConfig();

  if (client === undefined) {
    console.warn(DEPRECATION);
    return {
      proxyEnabled: true,
      globalsApplied: false,
      clientConfigured: false,
    } satisfies ConfigureResult;
  }

  return configureClient(client, proxy);
}
