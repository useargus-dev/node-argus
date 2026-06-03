import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import {
  ArgusConnectionError,
  ArgusError,
  ArgusInvalidResponseError,
} from "../errors.js";
import { raiseForIpcResponse, type IpcResponsePayload } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 130_000;

interface IpcRequest {
  request_id: string;
  bucket_id: string;
  client_token: string;
  cwd?: string;
}

export interface ProxyConfig {
  enabled: boolean;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
  caBundlePath: string;
}

export interface FetchBucketEnvResult {
  env: Record<string, string>;
  proxy: ProxyConfig | null;
}

function socketPath(): string {
  return path.join(os.homedir(), ".argus", "argus.sock");
}

function connectionHint(): string {
  if (process.platform === "win32") {
    return "Is Argus signed in and running? The named pipe \\\\.\\pipe\\argus must exist.";
  }
  return `Is Argus signed in and running? Expected Unix socket at ${socketPath()}.`;
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
      settle(() =>
        reject(
          new Error(
            `timed out after ${timeoutMs}ms waiting for Argus IPC response`,
          ),
        ),
      );
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
        settle(() =>
          reject(new Error("Argus closed the connection without a response")),
        );
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

function parseProxy(raw: unknown): ProxyConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  try {
    return {
      enabled: Boolean(p.enabled),
      httpProxy: String(p.httpProxy),
      httpsProxy: String(p.httpsProxy),
      noProxy: String(p.noProxy ?? "localhost,127.0.0.1,::1"),
      caBundlePath: String(p.caBundlePath),
    };
  } catch {
    throw new ArgusInvalidResponseError(
      "Argus proxy block is missing required fields",
    );
  }
}

function parseResponse(raw: string): FetchBucketEnvResult {
  let resp: IpcResponsePayload;
  try {
    resp = JSON.parse(raw) as IpcResponsePayload;
  } catch {
    throw new ArgusInvalidResponseError(
      "Argus returned non-JSON response. Is the Argus app up to date?",
    );
  }

  if (resp.status === "ok" && resp.env) {
    const proxy = (resp as IpcResponsePayload & { proxy?: unknown }).proxy;
    return { env: resp.env, proxy: parseProxy(proxy) };
  }

  raiseForIpcResponse(resp);
}

export function applyProxyToProcessEnv(proxy: ProxyConfig | null): void {
  if (!proxy?.enabled) return;
  process.env.HTTP_PROXY = proxy.httpProxy;
  process.env.HTTPS_PROXY = proxy.httpsProxy;
  process.env.http_proxy = proxy.httpProxy;
  process.env.https_proxy = proxy.httpsProxy;
  process.env.NO_PROXY = proxy.noProxy;
  process.env.no_proxy = proxy.noProxy;
  process.env.NODE_EXTRA_CA_CERTS = proxy.caBundlePath;
  if (process.version.localeCompare("v24.0.0", undefined, { numeric: true }) >= 0) {
    process.env.NODE_USE_ENV_PROXY = "1";
  }
}

export interface FetchBucketEnvOptions {
  bucketId: string;
  clientToken: string;
  cwd?: string;
  timeoutMs?: number;
}

export async function fetchBucketEnv(
  options: FetchBucketEnvOptions,
): Promise<FetchBucketEnvResult> {
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
          `Argus socket not found at ${sock}. ${connectionHint()}`,
        );
      }
      raw = await sendUnix(sock, payload, timeoutMs);
    }
  } catch (e) {
    if (e instanceof ArgusError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("timed out")) {
      throw new ArgusConnectionError(
        `${msg}. If this is the first connection, approve the client in Argus (up to 120s).`,
      );
    }
    if (msg.includes("without a response")) {
      throw new ArgusConnectionError(`${msg}. ${connectionHint()}`);
    }
    throw new ArgusConnectionError(`${msg}. ${connectionHint()}`);
  }

  return parseResponse(raw);
}
