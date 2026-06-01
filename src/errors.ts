export class ArgusError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.name = "ArgusError";
    this.code = code;
    this.requestId = requestId;
  }

  override toString(): string {
    const base = `[${this.code}] ${this.message}`;
    return this.requestId ? `${base} (request_id=${this.requestId})` : base;
  }
}

export class ArgusConnectionError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("CONNECTION_ERROR", message, requestId);
    this.name = "ArgusConnectionError";
  }
}

export class ArgusLockedError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("LOCKED", message, requestId);
    this.name = "ArgusLockedError";
  }
}

export class ArgusDeniedError extends ArgusError {
  readonly deniedCode: string;

  constructor(
    deniedCode: string,
    message: string,
    requestId?: string,
  ) {
    super(deniedCode, message, requestId);
    this.name = "ArgusDeniedError";
    this.deniedCode = deniedCode;
  }
}

export class ArgusApprovalTimeoutError extends ArgusDeniedError {
  constructor(message: string, requestId?: string) {
    super("APPROVAL_TIMEOUT", message, requestId);
    this.name = "ArgusApprovalTimeoutError";
  }
}

export class ArgusApprovalDeniedError extends ArgusDeniedError {
  constructor(message: string, requestId?: string) {
    super("APPROVAL_DENIED", message, requestId);
    this.name = "ArgusApprovalDeniedError";
  }
}

export class ArgusBucketNotFoundError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("BUCKET_NOT_FOUND", message, requestId);
    this.name = "ArgusBucketNotFoundError";
  }
}

export class ArgusInvalidTokenError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("INVALID_TOKEN", message, requestId);
    this.name = "ArgusInvalidTokenError";
  }
}

export class ArgusBucketInactiveError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("BUCKET_INACTIVE", message, requestId);
    this.name = "ArgusBucketInactiveError";
  }
}

export class ArgusInvalidRequestError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("INVALID_REQUEST", message, requestId);
    this.name = "ArgusInvalidRequestError";
  }
}

export class ArgusPeerResolveError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("PEER_RESOLVE", message, requestId);
    this.name = "ArgusPeerResolveError";
  }
}

export class ArgusProxyError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("PROXY_ERROR", message, requestId);
    this.name = "ArgusProxyError";
  }
}

export class ArgusInvalidResponseError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("INVALID_RESPONSE", message, requestId);
    this.name = "ArgusInvalidResponseError";
  }
}

export class ArgusConfigureError extends ArgusError {
  constructor(message: string, requestId?: string) {
    super("CONFIGURE_ERROR", message, requestId);
    this.name = "ArgusConfigureError";
  }
}
