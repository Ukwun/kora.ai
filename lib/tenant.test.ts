import test from "node:test";
import assert from "node:assert/strict";

import { enforceTenantIsolation, getPlanSummary } from "./tenant";

test("getPlanSummary returns the correct monthly price and seat allowance", () => {
  assert.deepEqual(getPlanSummary("growth"), {
    label: "Growth",
    monthlyPrice: 34000,
    seats: 12,
    description: "Advanced reports • automation • team roles",
  });
});

test("tenant scoping excludes records that belong to other organizations", () => {
  const rows = [{ organizationId: "org_a", id: "one" }, { organizationId: "org_b", id: "two" }];
  assert.deepEqual(enforceTenantIsolation(rows, "org_a"), [{ organizationId: "org_a", id: "one" }]);
});
