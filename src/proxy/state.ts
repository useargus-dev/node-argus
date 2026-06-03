import type { ProxyConfig } from "../ipc/client.js";

let cachedProxy: ProxyConfig | null = null;

export function setCachedProxy(proxy: ProxyConfig | null): void {
  cachedProxy = proxy;
}

export function getCachedProxy(): ProxyConfig | null {
  return cachedProxy;
}

export function clearCachedProxy(): void {
  cachedProxy = null;
}
