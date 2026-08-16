import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const roles = ["ADMIN", "DIRECTION", "BILLING", "COLLECTIONS", "RECONCILIATION", "FINANCE", "BI"] as const;
const password = z.string().min(8).max(72).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/);
const userSelect = { id: true, email: true, fullName: true, role: true, jobTitle: true, phone: true, active: true, createdAt: true, lastLoginAt: true } as const;

router.use(requireAuth, requireRoles("ADMIN", "DIRECTION"));

router.get("/", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const users = await prisma.user.findMany({ where: { organizationId: auth.organizationId }, select: userSelect, orderBy: [{ active: "desc" }, { fullName: "asc" }] });
  return res.json({ users });
}));

router.post("/", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = z.object({
    fullName: z.string().trim().min(3).max(100),
    email: z.email().transform((value) => value.trim().toLowerCase()),
    role: z.enum(roles),
    password,
    jobTitle: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(24).optional()
  }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revisa los datos. La contraseña requiere 8 caracteres, mayúscula, minúscula y número." });
  if (await prisma.user.findUnique({ where: { email: input.data.email } })) return res.status(409).json({ message: "Ese correo ya está registrado." });

  const created = await prisma.user.create({ data: {
    organizationId: auth.organizationId,
    fullName: input.data.fullName,
    email: input.data.email,
    role: input.data.role,
    passwordHash: await bcrypt.hash(input.data.password, 12),
    jobTitle: input.data.jobTitle || null,
    phone: input.data.phone || null
  }, select: userSelect });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "USER_CREATED", entityType: "USER", entityId: created.id, detail: { email: created.email, role: created.role }, ipAddress: req.ip });
  return res.status(201).json({ user: created });
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!userId) return res.status(400).json({ message: "Identificador de usuario inválido." });
  const input = z.object({
    fullName: z.string().trim().min(3).max(100).optional(),
    role: z.enum(roles).optional(),
    jobTitle: z.string().trim().max(100).nullable().optional(),
    phone: z.string().trim().max(24).nullable().optional(),
    active: z.boolean().optional()
  }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "No se recibieron cambios válidos." });
  const target = await prisma.user.findFirst({ where: { id: userId, organizationId: auth.organizationId } });
  if (!target) return res.status(404).json({ message: "Usuario no encontrado." });
  if (target.id === auth.id && input.data.active === false) return res.status(400).json({ message: "No puedes desactivar tu propia cuenta." });

  const removesAdmin = target.role === "ADMIN" && (input.data.active === false || (input.data.role && input.data.role !== "ADMIN"));
  if (removesAdmin && await prisma.user.count({ where: { organizationId: auth.organizationId, role: "ADMIN", active: true } }) <= 1) {
    return res.status(400).json({ message: "La empresa debe conservar al menos un administrador activo." });
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: input.data, select: userSelect });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "USER_UPDATED", entityType: "USER", entityId: updated.id, detail: { role: updated.role, active: updated.active }, ipAddress: req.ip });
  return res.json({ user: updated });
}));

export default router;
