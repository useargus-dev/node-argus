import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);

// Built by `npm test` before this file runs.

test("ESM import exposes loadEnv", async () => {
  const { loadEnv } = await import("../dist/index.js");
  assert.equal(typeof loadEnv, "function");
});

test("CommonJS require exposes loadEnv", () => {
  const { loadEnv } = require("../dist/index.cjs");
  assert.equal(typeof loadEnv, "function");
});
