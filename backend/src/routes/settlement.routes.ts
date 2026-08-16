import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import type { AuthenticatedRequest, MatchCandidate } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const schema = z.object({ invoiceId: z.string().min(1).optional() });

router.post("/:caseId/execute", requireAuth, requireRoles("ADMIN", "DIRECTION", "FINANCE"), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = schema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Solicitud inválida." });

  const caseId = String(req.params.caseId ?? "");
  const matchCase = await prisma.reconciliationCase.findFirst({
    where: { id: caseId, organizationId: auth.organizationId },
    include: { payment: true, approval: true, settlement: true }
  });
  if (!matchCase) return res.status(404).json({ message: "Caso no encontrado." });
  if (matchCase.settlement) return res.status(409).json({ message: "Este caso ya fue aplicado." });
  if (matchCase.policyDecision === "BLOCKED") return res.status(409).json({ message: "El Policy Engine mantiene bloqueado este caso." });
  if (matchCase.approval?.status !== "APPROVED") return res.status(409).json({ message: "Se requiere una aprobación vigente." });

  const candidates = matchCase.candidates as unknown as MatchCandidate[];
  const invoiceId = input.data.invoiceId ?? candidates[0]?.invoiceId;
  if (!invoiceId || !candidates.some((candidate) => candidate.invoiceId === invoiceId)) {
    return res.status(400).json({ message: "La factura no pertenece a los candidatos autorizados." });
  }

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId: auth.organizationId, status: "OPEN" } });
    if (!invoice) throw new Error("La factura seleccionada ya no está abierta.");
    const applied = Math.min(Number(matchCase.payment.amount), Number(invoice.openAmount));
    const remaining = Number(invoice.openAmount) - applied;
    const settlement = await tx.settlement.create({
      data: {
        organizationId: auth.organizationId,
        caseId: matchCase.id,
        paymentId: matchCase.paymentId,
        reference: `APL-${Date.now()}-${matchCase.id.slice(-6).toUpperCase()}`,
        items: { create: [{ invoiceId, amount: applied }] }
      },
      include: { items: true }
    });
    await tx.invoice.update({ where: { id: invoiceId }, data: { openAmount: remaining, status: remaining <= 0.01 ? "PAID" : "OPEN" } });
    await tx.payment.update({ where: { id: matchCase.paymentId }, data: { status: "APPLIED" } });
    await tx.reconciliationCase.update({ where: { id: matchCase.id }, data: { status: "SETTLED" } });
    return settlement;
  });

  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "PAYMENT_SETTLED", entityType: "SETTLEMENT", entityId: result.id, detail: { caseId: matchCase.id, invoiceId }, ipAddress: req.ip });
  const [open, unmatched, settlements] = await Promise.all([
    prisma.invoice.aggregate({ where: { organizationId: auth.organizationId, status: "OPEN" }, _count: true, _sum: { openAmount: true } }),
    prisma.payment.count({ where: { organizationId: auth.organizationId, status: "UNMATCHED" } }),
    prisma.settlement.count({ where: { organizationId: auth.organizationId } })
  ]);
  const indicators = { openInvoices: open._count, openAmount: Number(open._sum.openAmount ?? 0), unmatchedPayments: unmatched, settlements };
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "INDICATORS_RECALCULATED", entityType: "ORGANIZATION", entityId: auth.organizationId, detail: indicators, ipAddress: req.ip });
  return res.status(201).json({ settlement: result, indicators });
}));

export default router;
