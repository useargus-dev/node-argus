export { loadEnv } from "./load-env.js";
export type { LoadEnvOptions, LoadEnvResult } from "./load-env.js";

export { configure } from "./configure.js";
export type { ConfigureResult } from "./configure.js";

export {
  loadProxies,
  applyUndiciGlobalProxy,
  resolveProxyAgentOptions,
} from "./load-proxies.js";
export type { LoadProxiesOptions, ProxyAgentOptions } from "./load-proxies.js";

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

export { fetchBucketEnv } from "./ipc-client.js";
export type { FetchBucketEnvOptions } from "./ipc-client.js";

export { raiseForIpcResponse } from "./ipc-errors.js";
export type { IpcResponsePayload } from "./ipc-errors.js";
