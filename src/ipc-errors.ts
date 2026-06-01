import {
  ArgusApprovalDeniedError,
  ArgusApprovalTimeoutError,
  ArgusBucketInactiveError,
  ArgusBucketNotFoundError,
  ArgusError,
  ArgusInvalidRequestError,
  ArgusInvalidResponseError,
  ArgusInvalidTokenError,
  ArgusLockedError,
  ArgusPeerResolveError,
  ArgusProxyError,
} from "./errors.js";

export type IpcResponsePayload = {
  status?: string;
  request_id?: string;
  code?: string;
  message?: string;
  env?: Record<string, string>;
};

type IpcErrorCtor = new (message: string, requestId?: string) => ArgusError;

const IPC_ERROR_CLASSES: Record<string, IpcErrorCtor> = {
  BUCKET_NOT_FOUND: ArgusBucketNotFoundError,
  NOT_FOUND: ArgusBucketNotFoundError,
  INVALID_TOKEN: ArgusInvalidTokenError,
  BUCKET_INACTIVE: ArgusBucketInactiveError,
  INVALID_REQUEST: ArgusInvalidRequestError,
  PEER_RESOLVE: ArgusPeerResolveError,
  PROXY_ERROR: ArgusProxyError,
  NOT_SIGNED_IN: ArgusLockedError,
  SERIALIZE_ERROR: ArgusInvalidResponseError,
};

function fallbackMessage(code: string): string {
  const messages: Record<string, string> = {
    BUCKET_NOT_FOUND:
      "Bucket not found. Verify ARGUS_BUCKET_ID in your .env matches a bucket in Argus.",
    INVALID_TOKEN:
      "Client token rejected. Regenerate the token in Argus and update ARGUS_BUCKET_TOKEN.",
    BUCKET_INACTIVE:
      "Bucket is paused. Activate it in Argus (Buckets page or system tray).",
    PEER_RESOLVE:
      "Argus could not identify this process. Retry from a normal terminal or IDE.",
    PROXY_ERROR:
      "Bucket proxy is misconfigured in Argus. Check proxy settings for this bucket.",
  };
  return (
    messages[code] ??
    "Argus returned an error. Check that Argus is signed in and the bucket is active."
  );
}

export function raiseForIpcResponse(resp: IpcResponsePayload): never {
  const requestId =
    typeof resp.request_id === "string" ? resp.request_id : undefined;

  if (resp.status === "locked") {
    throw new ArgusLockedError(
      resp.message ??
        "Argus is not signed in. Sign in to the Argus app and retry.",
      requestId,
    );
  }

  if (resp.status === "denied") {
    const msg =
      resp.message ??
      "Access denied. Approve this client in Argus and retry.";
    const code = resp.code ?? "APPROVAL_DENIED";
    if (code === "APPROVAL_TIMEOUT") {
      throw new ArgusApprovalTimeoutError(msg, requestId);
    }
    throw new ArgusApprovalDeniedError(msg, requestId);
  }

  if (resp.status === "error") {
    const code = resp.code ?? "IPC_ERROR";
    const msg = resp.message ?? fallbackMessage(code);
    const Cls = IPC_ERROR_CLASSES[code];
    if (Cls) {
      throw new Cls(msg, requestId);
    }
    throw new ArgusError(code, msg, requestId);
  }

  throw new ArgusInvalidResponseError(
    `Unexpected IPC status: ${String(resp.status)}`,
    requestId,
  );
}
