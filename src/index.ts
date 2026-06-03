export { loadEnv } from "./env/load.js";
export type { LoadEnvOptions, LoadEnvResult } from "./env/load.js";

export {
  getProxyConfig,
  requireProxyConfig,
  proxyUrl,
} from "./proxy/config.js";

export {
  argusUndiciClientConfig,
  argusFetchClientConfig,
  argusAxiosClientConfig,
  argusHttpsClientConfig,
  argusAnthropicClientConfig,
  argusLangChainAnthropicClientConfig,
  argusAxiosCreateConfig,
  argusFetchConfig,
  createArgusUndiciDispatcher,
  createArgusHttpsProxyAgent,
} from "./proxy/wiring.js";
export type {
  ArgusUndiciClientConfig,
  ArgusFetchClientConfig,
  ArgusAxiosClientConfig,
  ArgusHttpsClientConfig,
  ArgusAnthropicClientConfig,
  ArgusLangChainAnthropicClientConfig,
  ArgusAxiosCreateConfig,
} from "./proxy/wiring.js";

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
