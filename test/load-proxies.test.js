import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const PROXY_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "ARGUS_BUCKET_TOKEN",
  "NODE_EXTRA_CA_CERTS",
];

function clearProxyEnv() {
  for (const key of PROXY_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearProxyEnv();
});

test("loadProxies returns false without proxy env (ESM)", async () => {
  clearProxyEnv();
  const { loadProxies } = await import("../dist/index.js");
  assert.equal(loadProxies(), false);
});

test("resolveProxyAgentOptions sets Basic token for user-only URL", async () => {
  const { resolveProxyAgentOptions } = await import("../dist/index.js");
  const opts = resolveProxyAgentOptions("http://mytoken@127.0.0.1:9000");
  assert.ok(opts);
  assert.equal(opts.uri, "http://127.0.0.1:9000");
  assert.equal(opts.token, `Basic ${Buffer.from("mytoken:").toString("base64")}`);
});

test("resolveProxyAgentOptions uses ARGUS_BUCKET_TOKEN when URL has no user", async () => {
  process.env.ARGUS_BUCKET_TOKEN = "from-env";
  const { resolveProxyAgentOptions } = await import("../dist/index.js");
  const opts = resolveProxyAgentOptions("http://127.0.0.1:9000");
  assert.ok(opts);
  assert.equal(opts.token, `Basic ${Buffer.from("from-env:").toString("base64")}`);
});

test("loadProxies returns true with HTTPS_PROXY (ESM)", async () => {
  clearProxyEnv();
  process.env.HTTPS_PROXY = "http://token@127.0.0.1:9000";
  const { loadProxies } = await import("../dist/index.js");
  assert.equal(loadProxies(), true);
});

test("loadProxies returns true with HTTPS_PROXY (CJS)", async () => {
  clearProxyEnv();
  process.env.HTTPS_PROXY = "http://token@127.0.0.1:9000";
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { loadProxies } = require("../dist/index.cjs");
  assert.equal(loadProxies(), true);
});
