import { createRequire } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export type LoadProxiesOptions = {
  httpProxy?: string;
  httpsProxy?: string;
};

export type ProxyAgentOptions = {
  uri: string;
  token: string;
  requestTls?: { ca: Buffer };
};

type UndiciProxyModule = {
  ProxyAgent: new (opts: ProxyAgentOptions) => unknown;
  setGlobalDispatcher: (agent: unknown) => void;
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
 * Undici only auto-auth when both username and password are in the URL;
 * Argus uses http://TOKEN@host (empty password), so we set token explicitly.
 */
export function resolveProxyAgentOptions(
  proxyUrl: string,
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
    parsed.port ||
    (parsed.protocol === "https:" ? "443" : "80");
  const uri = `${parsed.protocol}//${parsed.hostname}:${port}`;

  const options: ProxyAgentOptions = {
    uri,
    token: `Basic ${credentials}`,
  };

  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  if (caPath && fs.existsSync(caPath)) {
    options.requestTls = { ca: fs.readFileSync(caPath) };
  }

  return options;
}

/**
 * Set undici global ProxyAgent from current HTTP_PROXY / HTTPS_PROXY env.
 * Used by configure(); returns false when proxy URL or token is missing.
 */
export function applyUndiciGlobalProxy(
  options?: LoadProxiesOptions,
): boolean {
  const url =
    options?.httpsProxy ??
    options?.httpProxy ??
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;

  if (!url) {
    return false;
  }

  const agentOptions = resolveProxyAgentOptions(url);
  if (!agentOptions) {
    return false;
  }

  const { ProxyAgent, setGlobalDispatcher } = getUndici();
  setGlobalDispatcher(new ProxyAgent(agentOptions));
  return true;
}

/**
 * @deprecated Use {@link configure} instead. Applies undici global dispatcher only.
 */
export function loadProxies(options?: LoadProxiesOptions): boolean {
  return applyUndiciGlobalProxy(options);
}
