export { loadEnv } from "./env/load.js";
export type { LoadEnvOptions, LoadEnvResult } from "./env/load.js";

export { configure } from "./proxy/configure.js";
export type { ConfigureResult } from "./proxy/configure.js";

export {
  getProxyConfig,
  requireProxyConfig,
  proxyUrl,
} from "./proxy/config.js";

export {
  createProxyAgents,
  anthropicHttpAgent,
  fetchOptions,
  fetchAgentOptions,
  configureAxios,
  axiosDefaults,
  createUndiciProxyAgent,
  createHttpsAgent,
} from "./proxy/factories.js";
export type { ProxyAgents, FetchInitOptions, AxiosLike } from "./proxy/factories.js";

export {
  loadProxies,
  applyUndiciGlobalProxy,
  resolveProxyAgentOptions,
} from "./proxy/undici.js";
export type { LoadProxiesOptions, ProxyAgentOptions } from "./proxy/undici.js";

export {
  ArgusError,
  ArgusConnectionError,
  ArgusDeniedError,
  ArgusApprovalDeniedError,
  ArgusApprovalTimeoutError,
  ArgusBucketInactiveError,
  ArgusBucketNotFoundError,
  ArgusConfigureError,
  ArgusInvalidRequestError,
  ArgusInvalidResponseError,
  ArgusInvalidTokenError,
  ArgusLockedError,
  ArgusPeerResolveError,
  ArgusProxyError,
} from "./errors.js";

export { fetchBucketEnv } from "./ipc/client.js";
export type { FetchBucketEnvOptions, ProxyConfig } from "./ipc/client.js";

export { raiseForIpcResponse } from "./ipc/errors.js";
export type { IpcResponsePayload } from "./ipc/errors.js";
