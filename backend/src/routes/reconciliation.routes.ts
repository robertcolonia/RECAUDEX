import { Router } from "express";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import { generateCaseForPayment } from "../services/reconciliation.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/payments", requireAuth, asyncHandler(async (req, res) => {
  const { organizationId } = (req as AuthenticatedRequest).auth;
  const candidates = await prisma.payment.findMany({
    where: { organizationId, status: "UNMATCHED", cases: { none: {} }, declaredInvoice: { not: null } },
    include: { customer: { select: { legalName: true, taxId: true } } },
    orderBy: { paidAt: "desc" },
    take: 100
  });
  const references = candidates.map((payment) => payment.declaredInvoice).filter((value): value is string => !!value);
  const openInvoices = await prisma.invoice.findMany({ where: { organizationId, status: "OPEN", externalId: { in: references } }, select: { externalId: true } });
  const available = new Set(openInvoices.map((invoice) => invoice.externalId));
  return res.json({ payments: candidates.filter((payment) => payment.declaredInvoice && available.has(payment.declaredInvoice)).slice(0, 25) });
}));

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { organizationId } = (req as AuthenticatedRequest).auth;
  const cases = await prisma.reconciliationCase.findMany({
    where: { organizationId },
    include: {
      payment: { include: { customer: { select: { legalName: true, taxId: true } } } },
      approval: true,
      settlement: true
    },
    orderBy: [{ status: "asc" }, { confidence: "desc" }],
    take: 250
  });
  return res.json({ cases });
}));

router.post("/generate", requireAuth, requireRoles("ADMIN", "DIRECTION", "RECONCILIATION", "FINANCE"), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const payments = await prisma.payment.findMany({
    where: { organizationId: auth.organizationId, status: "UNMATCHED", cases: { none: {} } },
    orderBy: { paidAt: "desc" },
    take: 200
  });

  let created = 0;
  for (const payment of payments) {
    try { if ((await generateCaseForPayment(payment.id, auth.organizationId)).created) created += 1; } catch { /* Los pagos sin candidatos permanecen pendientes. */ }
  }

  await audit({
    organizationId: auth.organizationId,
    userId: auth.id,
    action: "MATCH_BATCH_GENERATED",
    entityType: "RECONCILIATION_CASE",
    detail: { reviewedPayments: payments.length, created },
    ipAddress: req.ip
  });
  return res.status(201).json({ created, reviewedPayments: payments.length });
}));

router.post("/generate/:paymentId", requireAuth, requireRoles("ADMIN", "DIRECTION", "RECONCILIATION", "FINANCE"), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const paymentId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
  if (!paymentId) return res.status(400).json({ message: "Selecciona un pago válido." });
  try {
    const result = await generateCaseForPayment(paymentId, auth.organizationId);
    if (result.created) {
      await audit({ organizationId: auth.organizationId, userId: auth.id, action: "MATCH_CANDIDATES_GENERATED", entityType: "RECONCILIATION_CASE", entityId: result.matchCase.id, detail: { paymentId, candidates: Array.isArray(result.matchCase.candidates) ? result.matchCase.candidates.length : 0 }, ipAddress: req.ip });
      await audit({ organizationId: auth.organizationId, userId: auth.id, action: "POLICY_EVALUATED", entityType: "RECONCILIATION_CASE", entityId: result.matchCase.id, detail: { decision: result.matchCase.policyDecision, checks: result.matchCase.policyChecks }, ipAddress: req.ip });
    }
    return res.status(result.created ? 201 : 200).json({ case: result.matchCase, created: result.created });
  } catch (cause) {
    return res.status(422).json({ message: cause instanceof Error ? cause.message : "No fue posible analizar el pago." });
  }
}));

export default router;
