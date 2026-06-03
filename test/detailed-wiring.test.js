import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const PROXY_KEYS = ["ARGUS_BUCKET_TOKEN"];

function clearEnv() {
  for (const key of PROXY_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearEnv();
});

function sampleProxy() {
  const caPath = path.join(os.tmpdir(), `argus-ca-${Date.now()}.pem`);
  fs.writeFileSync(caPath, "-----BEGIN CERTIFICATE-----\n");
  return {
    enabled: true,
    httpProxy: "http://tok@127.0.0.1:9000",
    httpsProxy: "http://tok@127.0.0.1:9000",
    noProxy: "localhost",
    caBundlePath: caPath,
  };
}

test("argusUndiciClientConfig builds derived fields", async () => {
  const { argusUndiciClientConfig } = await import("../dist/index.js");
  const proxy = sampleProxy();
  const cfg = await argusUndiciClientConfig(proxy);
  assert.equal(cfg.uri, "http://127.0.0.1:9000");
  assert.ok(cfg.token.startsWith("Basic "));
  assert.equal(cfg.caPath, proxy.caBundlePath);
});

test("argusAxiosClientConfig and argusHttpsClientConfig", async () => {
  const { argusAxiosClientConfig, argusHttpsClientConfig } = await import(
    "../dist/index.js"
  );
  const proxy = sampleProxy();
  const axios = await argusAxiosClientConfig(proxy);
  const https = await argusHttpsClientConfig(proxy);
  assert.equal(axios.proxyUrl, proxy.httpsProxy);
  assert.equal(axios.proxy, false);
  assert.equal(https.proxyUrl, proxy.httpsProxy);
  assert.equal(https.caPath, proxy.caBundlePath);
});

test("public API does not export ArgusProxyDetailed or argusProxyWiring", async () => {
  const mod = await import("../dist/index.js");
  assert.equal("getArgusProxyDetailed" in mod, false);
  assert.equal("argusProxyWiring" in mod, false);
});

test("argusAnthropicClientConfig and argusLangChainAnthropicClientConfig", async () => {
  const {
    argusAnthropicClientConfig,
    argusLangChainAnthropicClientConfig,
  } = await import("../dist/index.js");
  const proxy = sampleProxy();
  const anthropic = await argusAnthropicClientConfig(proxy);
  assert.ok(anthropic.fetchOptions.dispatcher);
  const langchain = await argusLangChainAnthropicClientConfig(proxy);
  assert.ok(langchain.clientOptions.fetchOptions.dispatcher);
});

test("argusFetchConfig and argusAxiosCreateConfig", async () => {
  const { argusFetchConfig, argusAxiosCreateConfig } = await import(
    "../dist/index.js"
  );
  const proxy = sampleProxy();
  const fetchCfg = await argusFetchConfig(proxy);
  assert.ok(fetchCfg.dispatcher);
  const axiosCfg = await argusAxiosCreateConfig(proxy);
  assert.ok(axiosCfg.httpsAgent);
  assert.equal(axiosCfg.httpAgent, axiosCfg.httpsAgent);
  assert.equal(axiosCfg.proxy, false);
});
