import { randomBytes } from "node:crypto";
import { raw, Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import { ALLOWED_AVATAR_MIME_TYPES, isValidAvatar } from "../services/avatar.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const registrationLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Se alcanzó el límite temporal de registros. Intenta más tarde." } });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Demasiados intentos de acceso. Espera unos minutos." } });
const strongPassword = z.string().min(8).max(72).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/);
const canonicalLoginEmail = (value: string) => value.trim().toLowerCase().replace(/@recaudex\.demo$/, "@recaudex.app");
const loginSchema = z.object({ email: z.email().transform(canonicalLoginEmail), password: z.string().min(8).max(72) });
const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationTaxId: z.string().trim().min(8).max(20).optional(),
  fullName: z.string().trim().min(3).max(100),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().max(24).optional(),
  password: strongPassword,
  confirmPassword: z.string()
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"] });

function claims(user: { id: string; organizationId: string; email: string; fullName: string; role: string }) {
  return { id: user.id, organizationId: user.organizationId, email: user.email, fullName: user.fullName, role: user.role };
}

function issueToken(user: { id: string; organizationId: string; email: string; fullName: string; role: string }) {
  return jwt.sign(claims(user), env.JWT_SECRET, { expiresIn: "8h" });
}

function userResponse(user: { id: string; organizationId: string; email: string; fullName: string; role: string; jobTitle: string | null; phone: string | null; avatarUpdatedAt: Date | null; organization: { name: string; taxId: string | null } }) {
  return { ...claims(user), jobTitle: user.jobTitle, phone: user.phone, avatarUpdatedAt: user.avatarUpdatedAt, organizationName: user.organization.name, organizationTaxId: user.organization.taxId };
}

function slugify(value: string) {
  const base = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 45) || "empresa";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

router.post("/register", registrationLimit, asyncHandler(async (req, res) => {
  const input = registerSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revisa los datos. La contraseña requiere 8 caracteres, mayúscula, minúscula y número." });
  if (await prisma.user.findUnique({ where: { email: input.data.email } })) return res.status(409).json({ message: "Ese correo ya está registrado." });
  if (input.data.organizationTaxId && await prisma.organization.findUnique({ where: { taxId: input.data.organizationTaxId } })) return res.status(409).json({ message: "Ya existe una empresa registrada con ese RUC." });

  const passwordHash = await bcrypt.hash(input.data.password, 12);
  const user = await prisma.$transaction(async (database) => {
    const organization = await database.organization.create({ data: { name: input.data.organizationName, taxId: input.data.organizationTaxId || null, slug: slugify(input.data.organizationName) } });
    return database.user.create({ data: { organizationId: organization.id, email: input.data.email, passwordHash, fullName: input.data.fullName, phone: input.data.phone || null, role: "ADMIN" }, include: { organization: true } });
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "ORGANIZATION_REGISTERED", entityType: "ORGANIZATION", entityId: user.organizationId, detail: { source: "public_registration" }, ipAddress: req.ip });
  return res.status(201).json({ token: issueToken(user), user: userResponse(user) });
}));

router.post("/login", loginLimit, asyncHandler(async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Correo o contraseña inválidos." });
  const user = await prisma.user.findUnique({ where: { email: input.data.email }, include: { organization: true } });
  if (!user?.active || !(await bcrypt.compare(input.data.password, user.passwordHash))) return res.status(401).json({ message: "Las credenciales no son correctas." });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "AUTH_LOGIN", entityType: "USER", entityId: user.id, detail: { method: "password" }, ipAddress: req.ip });
  return res.json({ token: issueToken(user), user: userResponse(user) });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const user = await prisma.user.findFirst({ where: { id: auth.id, organizationId: auth.organizationId, active: true }, include: { organization: true } });
  if (!user) return res.status(401).json({ message: "La cuenta ya no está disponible." });
  return res.json({ user: userResponse(user) });
}));

router.get("/avatar", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const user = await prisma.user.findFirst({
    where: { id: auth.id, organizationId: auth.organizationId, active: true },
    select: { avatarData: true, avatarMimeType: true, avatarUpdatedAt: true }
  });
  if (!user?.avatarData || !user.avatarMimeType) return res.status(404).json({ message: "El usuario no tiene foto de perfil." });

  res.setHeader("Content-Type", user.avatarMimeType);
  res.setHeader("Content-Length", user.avatarData.length);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(Buffer.from(user.avatarData));
}));

router.put(
  "/avatar",
  requireAuth,
  raw({ type: [...ALLOWED_AVATAR_MIME_TYPES], limit: "2mb" }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const mimeType = req.get("content-type")?.split(";").at(0)?.trim().toLowerCase() || "";
    const avatar = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!isValidAvatar(avatar, mimeType)) return res.status(400).json({ message: "Selecciona una imagen JPG, PNG o WebP válida de hasta 2 MB." });

    const user = await prisma.user.update({
      where: { id: auth.id },
      data: { avatarData: Uint8Array.from(avatar), avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      include: { organization: true }
    });
    await audit({ organizationId: auth.organizationId, userId: auth.id, action: "AVATAR_UPDATED", entityType: "USER", entityId: auth.id, detail: { mimeType, bytes: avatar.length }, ipAddress: req.ip });
    return res.json({ user: userResponse(user) });
  })
);

router.delete("/avatar", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const user = await prisma.user.update({
    where: { id: auth.id },
    data: { avatarData: null, avatarMimeType: null, avatarUpdatedAt: null },
    include: { organization: true }
  });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "AVATAR_REMOVED", entityType: "USER", entityId: auth.id, ipAddress: req.ip });
  return res.json({ user: userResponse(user) });
}));

router.patch("/profile", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = z.object({ fullName: z.string().trim().min(3).max(100).optional(), jobTitle: z.string().trim().max(100).nullable().optional(), phone: z.string().trim().max(24).nullable().optional() }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "No se recibieron cambios válidos." });
  const user = await prisma.user.update({ where: { id: auth.id }, data: input.data, include: { organization: true } });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "PROFILE_UPDATED", entityType: "USER", entityId: auth.id, detail: { fields: Object.keys(input.data) }, ipAddress: req.ip });
  return res.json({ user: userResponse(user) });
}));

router.patch("/email", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = z.object({ currentPassword: z.string().min(8).max(72), newEmail: z.email().transform((value) => value.trim().toLowerCase()), confirmEmail: z.email().transform((value) => value.trim().toLowerCase()) }).refine((value) => value.newEmail === value.confirmEmail).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Los correos no coinciden o no son válidos." });
  const current = await prisma.user.findFirst({ where: { id: auth.id, organizationId: auth.organizationId } });
  if (!current || !(await bcrypt.compare(input.data.currentPassword, current.passwordHash))) return res.status(401).json({ message: "La contraseña actual es incorrecta." });
  if (input.data.newEmail === current.email) return res.status(400).json({ message: "El nuevo correo debe ser diferente al actual." });
  if (await prisma.user.findUnique({ where: { email: input.data.newEmail } })) return res.status(409).json({ message: "Ese correo ya está registrado." });
  const user = await prisma.user.update({ where: { id: current.id }, data: { email: input.data.newEmail }, include: { organization: true } });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "EMAIL_UPDATED", entityType: "USER", entityId: auth.id, detail: { previousEmail: current.email }, ipAddress: req.ip });
  return res.json({ token: issueToken(user), user: userResponse(user) });
}));

router.patch("/password", requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = z.object({ currentPassword: z.string().min(8).max(72), newPassword: strongPassword, confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "La nueva contraseña debe coincidir y contener 8 caracteres, mayúscula, minúscula y número." });
  const current = await prisma.user.findFirst({ where: { id: auth.id, organizationId: auth.organizationId } });
  if (!current || !(await bcrypt.compare(input.data.currentPassword, current.passwordHash))) return res.status(401).json({ message: "La contraseña actual es incorrecta." });
  if (await bcrypt.compare(input.data.newPassword, current.passwordHash)) return res.status(400).json({ message: "La nueva contraseña debe ser diferente a la actual." });
  await prisma.user.update({ where: { id: current.id }, data: { passwordHash: await bcrypt.hash(input.data.newPassword, 12) } });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "PASSWORD_UPDATED", entityType: "USER", entityId: auth.id, detail: { sessions: "current_token_preserved" }, ipAddress: req.ip });
  return res.json({ message: "Contraseña actualizada correctamente." });
}));

export default router;
