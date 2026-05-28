import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import {
  ArgusConnectionError,
  ArgusDeniedError,
  ArgusError,
  ArgusLockedError,
} from "./errors.js";

const DEFAULT_TIMEOUT_MS = 130_000;

interface IpcRequest {
  request_id: string;
  bucket_id: string;
  client_token: string;
  cwd?: string;
}

interface IpcResponse {
  status: string;
  request_id?: string;
  env?: Record<string, string>;
  code?: string;
  message?: string;
}

function socketPath(): string {
  return path.join(os.homedir(), ".argus", "argus.sock");
}

function readLine(socket: net.Socket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    let settled = false;

    const settle = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeAllListeners("data");
      socket.removeAllListeners("error");
      socket.removeAllListeners("end");
      run();
    };

    const timer = setTimeout(() => {
      socket.destroy();
      settle(() => reject(new Error("timed out waiting for response")));
    }, timeoutMs);

    socket.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        settle(() => resolve(buf.slice(0, nl).trim()));
      }
    });
    socket.on("error", (e) => settle(() => reject(e)));
    socket.on("end", () => {
      if (buf.length > 0) {
        settle(() => resolve(buf.trim()));
      } else {
        settle(() => reject(new Error("connection closed without response")));
      }
    });
  });
}

async function sendUnix(
  sockPath: string,
  payload: IpcRequest,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: sockPath });
    const line = `${JSON.stringify(payload)}\n`;

    socket.once("connect", () => {
      readLine(socket, timeoutMs).then(resolve).catch(reject);
      socket.write(line, "utf8");
    });
    socket.once("error", reject);
  });
}

async function sendWindows(
  payload: IpcRequest,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect("\\\\.\\pipe\\argus");
    const line = `${JSON.stringify(payload)}\n`;

    socket.once("connect", () => {
      readLine(socket, timeoutMs).then(resolve).catch(reject);
      socket.write(line, "utf8");
    });
    socket.once("error", reject);
  });
}

export interface FetchBucketEnvOptions {
  bucketId: string;
  clientToken: string;
  cwd?: string;
  timeoutMs?: number;
}

export async function fetchBucketEnv(
  options: FetchBucketEnvOptions,
): Promise<Record<string, string>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const payload: IpcRequest = {
    request_id: randomUUID(),
    bucket_id: options.bucketId,
    client_token: options.clientToken,
    cwd: options.cwd ?? process.cwd(),
  };

  let raw: string;
  try {
    if (process.platform === "win32") {
      raw = await sendWindows(payload, timeoutMs);
    } else {
      const sock = socketPath();
      if (!fs.existsSync(sock)) {
        throw new ArgusConnectionError(
          `Argus socket not found at ${sock}. Sign in to Argus and keep the app running.`,
        );
      }
      raw = await sendUnix(sock, payload, timeoutMs);
    }
  } catch (e) {
    if (e instanceof ArgusError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      process.platform === "win32"
        ? "Is Argus signed in? Named pipe \\\\.\\pipe\\argus must exist."
        : "Is Argus signed in?";
    throw new ArgusConnectionError(`${msg}. ${hint}`);
  }

  let resp: IpcResponse;
  try {
    resp = JSON.parse(raw) as IpcResponse;
  } catch {
    throw new ArgusError("INVALID_RESPONSE", "Argus returned non-JSON response");
  }

  if (resp.status === "ok" && resp.env) {
    return resp.env;
  }
  if (resp.status === "locked") {
    throw new ArgusLockedError(
      resp.message ?? "Argus is not signed in (IPC unavailable until sign-in)",
    );
  }
  if (resp.status === "denied") {
    throw new ArgusDeniedError(
      resp.message ?? "Access denied (or approval timed out)",
    );
  }
  if (resp.status === "error") {
    throw new ArgusError(
      resp.code ?? "IPC_ERROR",
      resp.message ?? "Unknown Argus IPC error",
    );
  }

  throw new ArgusError("UNKNOWN_STATUS", `Unexpected IPC status: ${resp.status}`);
}
