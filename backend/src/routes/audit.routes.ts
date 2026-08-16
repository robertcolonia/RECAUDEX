import { Router } from "express";
import { prisma } from "../config/database.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { organizationId } = (req as AuthenticatedRequest).auth;
  const events = await prisma.auditEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { fullName: true, email: true } } }
  });
  return res.json({ events });
}));

export default router;

