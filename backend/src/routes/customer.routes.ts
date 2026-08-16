import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const editableRoles = ["ADMIN", "DIRECTION", "BILLING", "COLLECTIONS", "RECONCILIATION", "FINANCE"];
const customerSchema = z.object({
  taxId: z.string().trim().min(8).max(20),
  legalName: z.string().trim().min(2).max(160),
  segment: z.string().trim().max(60).optional(),
  status: z.string().trim().max(40).optional(),
  department: z.string().trim().max(60).optional(),
  province: z.string().trim().max(60).optional(),
  district: z.string().trim().max(60).optional()
});

router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const customers = await prisma.customer.findMany({
    where: { organizationId: auth.organizationId, ...(query ? { OR: [{ legalName: { contains: query, mode: "insensitive" } }, { taxId: { contains: query } }] } : {}) },
    select: { id: true, taxId: true, legalName: true, segment: true, status: true, department: true, province: true, district: true, createdAt: true, updatedAt: true },
    orderBy: { legalName: "asc" }, take: 250
  });
  return res.json({ customers });
}));

router.post("/", requireRoles(...editableRoles), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = customerSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revisa el RUC y la información del cliente." });
  if (await prisma.customer.findUnique({ where: { organizationId_taxId: { organizationId: auth.organizationId, taxId: input.data.taxId } } })) return res.status(409).json({ message: "Ese cliente ya está registrado." });
  const customer = await prisma.customer.create({ data: { organizationId: auth.organizationId, ...input.data, status: input.data.status || "ACTIVE" } });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "CUSTOMER_CREATED", entityType: "CUSTOMER", entityId: customer.id, detail: { taxId: customer.taxId }, ipAddress: req.ip });
  return res.status(201).json({ customer });
}));

router.patch("/:id", requireRoles(...editableRoles), asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!customerId) return res.status(400).json({ message: "Identificador de cliente inválido." });
  const input = customerSchema.partial().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "No se recibieron cambios válidos." });
  const current = await prisma.customer.findFirst({ where: { id: customerId, organizationId: auth.organizationId } });
  if (!current) return res.status(404).json({ message: "Cliente no encontrado." });
  if (input.data.taxId && input.data.taxId !== current.taxId && await prisma.customer.findUnique({ where: { organizationId_taxId: { organizationId: auth.organizationId, taxId: input.data.taxId } } })) return res.status(409).json({ message: "Ese RUC ya está registrado." });
  const customer = await prisma.customer.update({ where: { id: current.id }, data: input.data });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "CUSTOMER_UPDATED", entityType: "CUSTOMER", entityId: customer.id, detail: { status: customer.status }, ipAddress: req.ip });
  return res.json({ customer });
}));

export default router;
