import assert from "node:assert/strict";
import test from "node:test";
import { rankCandidates, scoreCandidate } from "../src/services/matching.service.js";

const invoice = {
  id: "inv-1",
  externalId: "F001-123",
  customerId: "customer-1",
  accountCode: "account-1",
  issuedAt: new Date("2026-06-01"),
  dueAt: new Date("2026-06-30"),
  totalAmount: 118,
  openAmount: 118
};

test("prioriza una coincidencia con referencia, cliente, cuenta y monto exactos", () => {
  const result = scoreCandidate({ amount: 118, paidAt: new Date("2026-06-15"), customerId: "customer-1", accountCode: "account-1", declaredInvoice: "F001-123" }, invoice);
  assert.equal(result.score, 1);
  assert.equal(result.signals.length, 5);
});

test("ordena los candidatos por evidencia y devuelve solo el límite solicitado", () => {
  const result = rankCandidates(
    { amount: 118, paidAt: new Date("2026-06-15"), customerId: "customer-1" },
    [invoice, { ...invoice, id: "inv-2", externalId: "F001-124", customerId: "customer-2", openAmount: 117.5 }],
    1
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]?.invoiceId, "inv-1");
});
