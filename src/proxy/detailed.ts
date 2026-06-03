import fs from "node:fs";

import type { ProxyConfig } from "../ipc/client.js";
import { ArgusConfigureError } from "../errors.js";
import { proxyUrl, requireProxyConfig } from "./config.js";

export type ArgusProxyDetailed = {
  proxy: ProxyConfig;
  url: string;
  httpProxyUrl: string;
  httpsProxyUrl: string;
  caBundlePath: string;
  noProxy: string;
  proxyAuthorization: string;
  connectUri: string;
  ca: Buffer;
};

function resolveProxyToken(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ArgusConfigureError("Invalid Argus proxy URL.");
  }
  const token = parsed.username
    ? decodeURIComponent(parsed.username)
    : process.env.ARGUS_BUCKET_TOKEN;
  if (!token) {
    throw new ArgusConfigureError(
      "ARGUS_BUCKET_TOKEN is required for Argus proxy authentication.",
    );
  }
  return token;
}

function proxyAuthorization(url: string): string {
  const parsed = new URL(url);
  const token = resolveProxyToken(url);
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";
  return `Basic ${Buffer.from(`${token}:${password}`, "utf8").toString("base64")}`;
}

function connectUri(url: string): string {
  const parsed = new URL(url);
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  return `${parsed.protocol}//${parsed.hostname}:${port}`;
}

/** Build derived proxy material from cached config (call after `loadEnv()`). */
export async function getArgusProxyDetailed(
  proxy?: ProxyConfig,
): Promise<ArgusProxyDetailed> {
  const cfg = proxy ?? (await requireProxyConfig());
  const url = proxyUrl(cfg);
  return {
    proxy: cfg,
    url,
    httpProxyUrl: cfg.httpProxy,
    httpsProxyUrl: cfg.httpsProxy,
    caBundlePath: cfg.caBundlePath,
    noProxy: cfg.noProxy,
    proxyAuthorization: proxyAuthorization(url),
    connectUri: connectUri(url),
    ca: fs.readFileSync(cfg.caBundlePath),
  };
}
