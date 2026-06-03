import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, afterEach } from "node:test";

const require = createRequire(import.meta.url);

const ORIGINAL_CWD = process.cwd();
const ENV_KEYS = ["ARGUS_BUCKET_ID", "ARGUS_BUCKET_TOKEN", "FOO", "BAR"];

function clearTestEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  clearTestEnv();
});

test("loadEnv applies .env when bucket credentials are missing (ESM)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "useargus-node-"));
  await writeFile(join(dir, ".env"), "FOO=from_dotenv\n");
  process.chdir(dir);
  clearTestEnv();

  const { loadEnv } = await import("../dist/index.js");
  const result = await loadEnv();

  assert.equal(result.source, "dotenv");
  assert.ok(result.keys.includes("FOO"));
  assert.equal(process.env.FOO, "from_dotenv");
});

test("loadEnv applies .env when bucket credentials are missing (CJS)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "useargus-node-"));
  await writeFile(join(dir, ".env"), "BAR=from_cjs\n");
  process.chdir(dir);
  clearTestEnv();

  const { loadEnv } = require("../dist/index.cjs");
  const result = await loadEnv();

  assert.equal(result.source, "dotenv");
  assert.ok(result.keys.includes("BAR"));
  assert.equal(process.env.BAR, "from_cjs");
});

test("loadEnv reads bucket credentials from .env before IPC", async () => {
  const dir = await mkdtemp(join(tmpdir(), "useargus-node-"));
  await writeFile(
    join(dir, ".env"),
    "ARGUS_BUCKET_ID=test-id\nARGUS_BUCKET_TOKEN=test-token\n",
  );
  process.chdir(dir);
  clearTestEnv();

  const { loadEnv } = await import("../dist/index.js");

  await assert.rejects(
    () => loadEnv(),
    (err) =>
      err.name === "ArgusConnectionError" ||
      err.name === "ArgusLockedError" ||
      err.name === "ArgusDeniedError" ||
      err.name === "ArgusError",
  );
});
