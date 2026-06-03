import { fetchBucketEnv, type ProxyConfig } from "../ipc/client.js";
import { ArgusConfigureError } from "../errors.js";
import { getCachedProxy, setCachedProxy } from "./state.js";

function bucketCredentials(): { bucketId?: string; token?: string } {
  return {
    bucketId: process.env.ARGUS_BUCKET_ID,
    token: process.env.ARGUS_BUCKET_TOKEN,
  };
}

/** Read proxy config cached by `loadEnv()`, or fetch from Argus when credentials are set. */
export async function getProxyConfig(): Promise<ProxyConfig | null> {
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

/** Cached proxy config; throws when proxy is unavailable or disabled. */
export async function requireProxyConfig(): Promise<ProxyConfig> {
  const proxy = await getProxyConfig();
  if (!proxy) {
    throw new ArgusConfigureError(
      "Argus proxy config is not available. Call loadEnv() first with valid " +
        "ARGUS_BUCKET_ID and ARGUS_BUCKET_TOKEN, or ensure Argus is signed in.",
    );
  }
  if (!proxy.enabled) {
    throw new ArgusConfigureError(
      "Argus proxy is disabled for this bucket. Enable 'Argus Proxy' in Argus " +
        "bucket settings, then call loadEnv() again.",
    );
  }
  return proxy;
}

export function proxyUrl(proxy: ProxyConfig): string {
  return proxy.httpsProxy || proxy.httpProxy;
}
