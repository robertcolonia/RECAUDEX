import { Router } from "express";
import { prisma } from "../config/database.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { organizationId } = (req as AuthenticatedRequest).auth;
  const [customers, invoices, openInvoices, payments, unmatched, cases, approvals, settled, recent] = await Promise.all([
    prisma.customer.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId } }),
    prisma.invoice.aggregate({ where: { organizationId, status: "OPEN" }, _count: true, _sum: { openAmount: true } }),
    prisma.payment.aggregate({ where: { organizationId }, _count: true, _sum: { amount: true } }),
    prisma.payment.count({ where: { organizationId, status: "UNMATCHED" } }),
    prisma.reconciliationCase.count({ where: { organizationId } }),
    prisma.approval.count({ where: { organizationId, status: "PENDING" } }),
    prisma.settlement.aggregate({ where: { organizationId }, _count: true }),
    prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, entityType: true, createdAt: true, detail: true, user: { select: { fullName: true } } }
    })
  ]);

  const reconciled = cases ? settled._count / cases : 0;
  return res.json({
    metrics: {
      customers,
      invoices,
      openInvoices: openInvoices._count,
      openAmount: Number(openInvoices._sum.openAmount ?? 0),
      payments: payments._count,
      collectedAmount: Number(payments._sum.amount ?? 0),
      unmatchedPayments: unmatched,
      pendingApprovals: approvals,
      reconciliationRate: Math.round(reconciled * 1000) / 10
    },
    recentActivity: recent
  });
}));

export default router;

