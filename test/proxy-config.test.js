import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const PROXY_KEYS = ["ARGUS_BUCKET_ID", "ARGUS_BUCKET_TOKEN"];

function clearEnv() {
  for (const key of PROXY_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearEnv();
});

test("getProxyConfig and requireProxyConfig are exported", async () => {
  const { getProxyConfig, requireProxyConfig, proxyUrl } = await import(
    "../dist/index.js"
  );
  assert.equal(typeof getProxyConfig, "function");
  assert.equal(typeof requireProxyConfig, "function");
  assert.equal(typeof proxyUrl, "function");

  const proxy = {
    enabled: true,
    httpProxy: "http://tok@127.0.0.1:9000",
    httpsProxy: "http://tok@127.0.0.1:9000",
    noProxy: "localhost",
    caBundlePath: "/tmp/ca.pem",
  };

  assert.equal(proxyUrl(proxy), proxy.httpsProxy);
});

test("requireProxyConfig throws when proxy unavailable", async () => {
  const { requireProxyConfig, ArgusConfigureError } = await import(
    "../dist/index.js"
  );
  await assert.rejects(
    () => requireProxyConfig(),
    (err) => err instanceof ArgusConfigureError,
  );
});
