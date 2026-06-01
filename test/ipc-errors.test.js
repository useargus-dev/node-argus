import assert from "node:assert/strict";
import { test } from "node:test";

import { raiseForIpcResponse } from "../dist/index.js";

test("raiseForIpcResponse maps BUCKET_NOT_FOUND", () => {
  assert.throws(
    () =>
      raiseForIpcResponse({
        status: "error",
        code: "BUCKET_NOT_FOUND",
        message: "Bucket 'x' was not found.",
        request_id: "req-1",
      }),
    (err) => {
      assert.equal(err.name, "ArgusBucketNotFoundError");
      assert.equal(err.code, "BUCKET_NOT_FOUND");
      assert.equal(err.requestId, "req-1");
      return true;
    },
  );
});

test("raiseForIpcResponse maps APPROVAL_TIMEOUT", () => {
  assert.throws(
    () =>
      raiseForIpcResponse({
        status: "denied",
        code: "APPROVAL_TIMEOUT",
        message: "Timed out.",
      }),
    (err) => {
      assert.equal(err.name, "ArgusApprovalTimeoutError");
      assert.equal(err.deniedCode, "APPROVAL_TIMEOUT");
      return true;
    },
  );
});

test("raiseForIpcResponse maps INVALID_TOKEN", () => {
  assert.throws(
    () =>
      raiseForIpcResponse({
        status: "error",
        code: "INVALID_TOKEN",
        message: "Client token rejected.",
      }),
    (err) => err.name === "ArgusInvalidTokenError",
  );
});

test("raiseForIpcResponse maps locked", () => {
  assert.throws(
    () =>
      raiseForIpcResponse({
        status: "locked",
        message: "Argus is not signed in.",
      }),
    (err) => err.name === "ArgusLockedError",
  );
});
