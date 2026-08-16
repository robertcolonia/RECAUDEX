import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { organizationId } = (req as AuthenticatedRequest).auth;
  const approvals = await prisma.approval.findMany({
    where: { organizationId },
    include: {
      requestedBy: { select: { fullName: true } },
      decidedBy: { select: { fullName: true } },
      case: { include: { payment: { include: { customer: { select: { legalName: true } } } } } }
    },
    orderBy: { requestedAt: "desc" },
    take: 250
  });
  return res.json({ approvals });
}));

router.post("/request/:caseId", requireAuth, requireRoles("ADMIN", "DIRECTION", "RECONCILIATION", "FINANCE"), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const caseId = String(req.params.caseId ?? "");
  const matchCase = await prisma.reconciliationCase.findFirst({ where: { id: caseId, organizationId: auth.organizationId } });
  if (!matchCase) return res.status(404).json({ message: "Caso no encontrado." });
  if (matchCase.policyDecision === "BLOCKED") return res.status(409).json({ message: "El Policy Engine bloqueó este caso; debe corregirse antes de solicitar aprobación." });

  const approval = await prisma.approval.upsert({
    where: { caseId: matchCase.id },
    create: { organizationId: auth.organizationId, caseId: matchCase.id, requestedById: auth.id },
    update: { status: "PENDING", requestedById: auth.id, requestedAt: new Date(), decidedAt: null, decidedById: null }
  });
  await prisma.reconciliationCase.update({ where: { id: matchCase.id }, data: { status: "PENDING_APPROVAL" } });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "APPROVAL_REQUESTED", entityType: "RECONCILIATION_CASE", entityId: matchCase.id, detail: { policyDecision: matchCase.policyDecision }, ipAddress: req.ip });
  return res.status(201).json({ approval });
}));

const decisionSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), comment: z.string().max(500).optional() });

router.post("/:id/decision", requireAuth, requireRoles("ADMIN", "DIRECTION", "FINANCE"), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = decisionSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Decisión inválida." });
  const approvalId = String(req.params.id ?? "");
  const approval = await prisma.approval.findFirst({ where: { id: approvalId, organizationId: auth.organizationId } });
  if (!approval) return res.status(404).json({ message: "Solicitud no encontrada." });
  if (approval.status !== "PENDING") return res.status(409).json({ message: "La solicitud ya fue decidida." });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.approval.update({
      where: { id: approval.id },
      data: { status: input.data.status, comment: input.data.comment, decidedById: auth.id, decidedAt: new Date() }
    });
    await tx.reconciliationCase.update({
      where: { id: approval.caseId },
      data: { status: input.data.status }
    });
    return result;
  });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: `APPROVAL_${input.data.status}`, entityType: "APPROVAL", entityId: approval.id, detail: { comment: input.data.comment }, ipAddress: req.ip });
  return res.json({ approval: updated });
}));

export default router;
