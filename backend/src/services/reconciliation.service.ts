import { prisma } from "../config/database.js";
import { confidenceLabel, rankCandidates } from "./matching.service.js";
import { evaluateReconciliationPolicy } from "./policy.service.js";

export async function generateCaseForPayment(paymentId: string, organizationId: string) {
  const existing = await prisma.reconciliationCase.findFirst({ where: { paymentId, organizationId }, include: { payment: { include: { customer: true } }, approval: true, settlement: true } });
  if (existing) return { matchCase: existing, created: false };
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, organizationId, status: "UNMATCHED" }, include: { customer: true } });
  if (!payment) throw new Error("El pago no existe, ya fue aplicado o no pertenece a la organización.");
  const amount = Number(payment.amount);
  const possibleInvoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: "OPEN",
      OR: [
        ...(payment.customerId ? [{ customerId: payment.customerId }] : []),
        ...(payment.accountCode ? [{ accountCode: payment.accountCode }] : []),
        { openAmount: { gte: Math.max(0, amount * 0.98), lte: amount * 1.02 } },
        ...(payment.declaredInvoice ? [{ externalId: payment.declaredInvoice }] : [])
      ]
    },
    take: 300
  });
  const candidates = rankCandidates({ amount, paidAt: payment.paidAt, customerId: payment.customerId, accountCode: payment.accountCode, declaredInvoice: payment.declaredInvoice }, possibleInvoices.map((invoice) => ({ id: invoice.id, externalId: invoice.externalId, customerId: invoice.customerId, accountCode: invoice.accountCode, issuedAt: invoice.issuedAt, dueAt: invoice.dueAt, totalAmount: Number(invoice.totalAmount), openAmount: Number(invoice.openAmount) })));
  if (!candidates.length) throw new Error("No se encontraron facturas candidatas para este pago.");
  const top = candidates[0]!;
  const policy = evaluateReconciliationPolicy({ paymentAmount: amount, candidates });
  const matchCase = await prisma.reconciliationCase.create({
    data: {
      organizationId,
      paymentId: payment.id,
      status: policy.decision === "BLOCKED" ? "BLOCKED" : top.score >= 0.85 ? "RECOMMENDED" : "REVIEW",
      confidence: top.score,
      candidates,
      rationale: `${confidenceLabel(top.score)}: ${top.signals.join(", ")}.`,
      policyDecision: policy.decision,
      policyChecks: policy.checks,
      policyEvaluatedAt: new Date()
    },
    include: { payment: { include: { customer: true } }, approval: true, settlement: true }
  });
  return { matchCase, policy, created: true };
}
