export { loadEnv } from "./env/load.js";
export type { LoadEnvOptions, LoadEnvResult } from "./env/load.js";

export { configure } from "./proxy/configure.js";
export type { ConfigureResult } from "./proxy/configure.js";

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
export type { FetchBucketEnvOptions } from "./ipc/client.js";

export { raiseForIpcResponse } from "./ipc/errors.js";
export type { IpcResponsePayload } from "./ipc/errors.js";
