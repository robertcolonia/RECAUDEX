import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReconciliationPolicy } from "../src/services/policy.service.js";

const candidate = (score: number, signals = ["monto exacto", "cliente coincidente"]) => ({ invoiceId: "invoice-1", externalId: "F001-123", customerId: "customer-1", totalAmount: 100, openAmount: 100, score, signals });

test("envía a aprobación un candidato fuerte y explicable", () => {
  const result = evaluateReconciliationPolicy({ paymentAmount: 100, candidates: [candidate(.95), { ...candidate(.5), invoiceId: "invoice-2" }] });
  assert.equal(result.decision, "APPROVAL_REQUIRED");
  assert.equal(result.checks.every((check) => check.passed), true);
});

test("deriva a revisión humana un resultado ambiguo", () => {
  const result = evaluateReconciliationPolicy({ paymentAmount: 100, candidates: [candidate(.7), { ...candidate(.65), invoiceId: "invoice-2" }] });
  assert.equal(result.decision, "MANUAL_REVIEW");
  assert.equal(result.passed, true);
});

test("bloquea un pago sin candidato", () => {
  const result = evaluateReconciliationPolicy({ paymentAmount: 100, candidates: [] });
  assert.equal(result.decision, "BLOCKED");
  assert.equal(result.passed, false);
});
