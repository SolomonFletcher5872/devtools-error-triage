import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticFingerprint } from "./error_triage.js";

test("groups failures by service and release", () => {
  assert.deepEqual(diagnosticFingerprint({ service: "checkout-api", release: "2026.09.03" }), ["checkout-api", "2026.09.03"]);
});
