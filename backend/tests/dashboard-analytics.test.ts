import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardAnalytics } from "../src/services/dashboard-analytics.service.js";

test("construye las series financieras y conserva sus totales", () => {
  const analytics = buildDashboardAnalytics(
    [
      { issuedAt: new Date("2026-06-01T00:00:00Z"), dueAt: new Date("2026-07-20T00:00:00Z"), totalAmount: 100, openAmount: 60 },
      { issuedAt: new Date("2026-07-01T00:00:00Z"), dueAt: new Date("2026-05-01T00:00:00Z"), totalAmount: 200, openAmount: 150 }
    ],
    [
      { paidAt: new Date("2026-06-15T00:00:00Z"), amount: 80, status: "UNMATCHED" },
      { paidAt: new Date("2026-07-15T00:00:00Z"), amount: 90, status: "UNMATCHED", caseStatus: "PENDING_APPROVAL" },
      { paidAt: new Date("2026-07-18T00:00:00Z"), amount: 30, status: "APPLIED", caseStatus: "SETTLED" }
    ],
    [{ detail: { agentCode: "A0" } }, { detail: { agentCode: "A3" } }, { detail: { agentCode: "A3" } }],
    new Date("2026-08-16T00:00:00Z")
  );

  assert.equal(analytics.monthlyRevenue.length, 8);
  assert.equal(analytics.monthlyRevenue.reduce((sum, item) => sum + item.billed, 0), 300);
  assert.equal(analytics.monthlyRevenue.reduce((sum, item) => sum + item.collected, 0), 200);
  assert.equal(analytics.paymentStatus.reduce((sum, item) => sum + item.value, 0), 3);
  assert.equal(analytics.paymentStatus.find((item) => item.key === "pendingApproval")?.value, 1);
  assert.equal(analytics.paymentStatus.find((item) => item.key === "applied")?.value, 1);
  assert.equal(analytics.aging.find((item) => item.key === "days1to30")?.amount, 60);
  assert.equal(analytics.aging.find((item) => item.key === "over90")?.amount, 150);
  assert.equal(analytics.agentActivity.find((item) => item.agent === "A3")?.cases, 2);
});
