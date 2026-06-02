import { createRequire } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export type LoadProxiesOptions = {
  httpProxy?: string;
  httpsProxy?: string;
  caBundlePath?: string;
};

export type ProxyAgentOptions = {
  uri: string;
  token: string;
  requestTls?: { ca: Buffer };
};

type UndiciProxyModule = {
  ProxyAgent: new (opts: ProxyAgentOptions) => unknown;
};

let undiciRequire: ReturnType<typeof createRequire> | null = null;

function getUndici(): UndiciProxyModule {
  if (!undiciRequire) {
    const filename =
      typeof __filename !== "undefined"
        ? __filename
        : fileURLToPath(import.meta.url);
    undiciRequire = createRequire(filename);
  }
  return undiciRequire("undici") as UndiciProxyModule;
}

/**
 * Build proxy URI (no credentials) and Proxy-Authorization header.
 * Argus uses http://TOKEN@host (empty password), so token is set explicitly.
 */
export function resolveProxyAgentOptions(
  proxyUrl: string,
  caBundlePath?: string,
): ProxyAgentOptions | null {
  let parsed: URL;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    return null;
  }

  const user = parsed.username ? decodeURIComponent(parsed.username) : "";
  const pass = parsed.password ? decodeURIComponent(parsed.password) : "";
  const bucketToken = process.env.ARGUS_BUCKET_TOKEN;
  const token = user || bucketToken;
  if (!token) {
    return null;
  }

  const credentials = Buffer.from(`${token}:${pass}`, "utf8").toString(
    "base64",
  );
  const port =
    parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  const uri = `${parsed.protocol}//${parsed.hostname}:${port}`;

  const options: ProxyAgentOptions = {
    uri,
    token: `Basic ${credentials}`,
  };

  const caPath =
    caBundlePath ??
    process.env.NODE_EXTRA_CA_CERTS ??
    undefined;
  if (caPath && fs.existsSync(caPath)) {
    options.requestTls = { ca: fs.readFileSync(caPath) };
  }

  return options;
}

/**
 * @deprecated Use {@link fetchOptions} instead. Does not set a global dispatcher.
 */
export function applyUndiciGlobalProxy(
  options?: LoadProxiesOptions,
): boolean {
  console.warn(
    "[@useargus/node] loadProxies() / applyUndiciGlobalProxy() is deprecated. " +
      "Use fetchOptions() and pass dispatcher to fetch().",
  );
  return resolveProxyAgentOptions(
    options?.httpsProxy ??
      options?.httpProxy ??
      process.env.HTTPS_PROXY ??
      process.env.https_proxy ??
      process.env.HTTP_PROXY ??
      process.env.http_proxy ??
      "",
    options?.caBundlePath,
  ) !== null;
}

/**
 * @deprecated Use {@link fetchOptions} instead.
 */
export function loadProxies(options?: LoadProxiesOptions): boolean {
  return applyUndiciGlobalProxy(options);
}

export function createUndiciProxyAgentFromUrl(
  proxyUrl: string,
  caBundlePath: string,
): unknown {
  const agentOptions = resolveProxyAgentOptions(proxyUrl, caBundlePath);
  if (!agentOptions) {
    throw new Error(
      "Could not build undici ProxyAgent (missing proxy URL or ARGUS_BUCKET_TOKEN).",
    );
  }
  const { ProxyAgent } = getUndici();
  return new ProxyAgent(agentOptions);
}
