export class ArgusError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ArgusError";
    this.code = code;
  }
}

export class ArgusConnectionError extends ArgusError {
  constructor(message: string) {
    super("CONNECTION_ERROR", message);
    this.name = "ArgusConnectionError";
  }
}

export class ArgusLockedError extends ArgusError {
  constructor(message: string) {
    super("LOCKED", message);
    this.name = "ArgusLockedError";
  }
}

export class ArgusDeniedError extends ArgusError {
  constructor(message: string) {
    super("DENIED", message);
    this.name = "ArgusDeniedError";
  }
}
