import test from "node:test";
import assert from "node:assert/strict";

import { getPlanSummary, syncIntegrationState, type TenantIntegration } from "./tenant";

test("getPlanSummary returns the correct monthly price and seat allowance", () => {
  assert.deepEqual(getPlanSummary("growth"), {
    label: "Growth",
    monthlyPrice: 34000,
    seats: 12,
    description: "Advanced reports • automation • team roles",
  });
});

test("syncIntegrationState marks a tool as connected and preserves organization isolation", () => {
  const integrations: TenantIntegration[] = [
    { type: "gmail", connected: false, metadata: { source: "manual" } },
    { type: "whatsapp", connected: true, metadata: { source: "manual" } },
  ];

  const updated = syncIntegrationState(integrations, "gmail");

  assert.equal(updated.find((integration) => integration.type === "gmail")?.connected, true);
  assert.equal(updated.filter((integration) => integration.connected).length, 2);
  assert.equal(updated[0].metadata?.source, "manual");
});
