import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { encryptField, fingerprintField } from "../services/field-encryption.service.js";
import { audit } from "../services/audit.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const permitted = ["ADMIN", "DIRECTION", "FINANCE", "RECONCILIATION"];
const baseSchema = z.object({
  bankName: z.string().trim().min(2).max(100),
  accountAlias: z.string().trim().min(2).max(80),
  accountHolder: z.string().trim().min(2).max(140),
  accountType: z.enum(["CURRENT", "SAVINGS", "COLLECTION"]),
  currency: z.enum(["PEN", "USD", "EUR"]).default("PEN"),
  accountNumber: z.string().trim().min(8).max(40),
  active: z.boolean().optional()
});
const publicSelect = { id: true, bankName: true, accountAlias: true, accountHolder: true, accountType: true, currency: true, accountNumberLast4: true, active: true, createdAt: true, updatedAt: true } as const;
const normalizeAccount = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();

router.use(requireAuth, requireRoles(...permitted));

router.get("/", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const accounts = await prisma.bankAccount.findMany({ where: { organizationId: auth.organizationId }, select: publicSelect, orderBy: [{ active: "desc" }, { bankName: "asc" }] });
  return res.json({ accounts: accounts.map((account) => ({ ...account, maskedAccountNumber: `•••• ${account.accountNumberLast4}` })) });
}));

router.post("/", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const input = baseSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revisa los datos de la cuenta bancaria." });
  const accountNumber = normalizeAccount(input.data.accountNumber);
  if (!/^[A-Z0-9]{8,34}$/.test(accountNumber)) return res.status(400).json({ message: "El número de cuenta contiene caracteres no válidos." });
  const fingerprint = fingerprintField(accountNumber);
  if (await prisma.bankAccount.findUnique({ where: { organizationId_accountFingerprint: { organizationId: auth.organizationId, accountFingerprint: fingerprint } } })) return res.status(409).json({ message: "Esa cuenta bancaria ya está registrada." });
  const account = await prisma.bankAccount.create({ data: {
    organizationId: auth.organizationId,
    bankName: input.data.bankName,
    accountAlias: input.data.accountAlias,
    accountHolder: input.data.accountHolder,
    accountType: input.data.accountType,
    currency: input.data.currency,
    active: input.data.active ?? true,
    accountNumberEncrypted: encryptField(accountNumber),
    accountNumberLast4: accountNumber.slice(-4),
    accountFingerprint: fingerprint
  }, select: publicSelect });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "BANK_ACCOUNT_CREATED", entityType: "BANK_ACCOUNT", entityId: account.id, detail: { bankName: account.bankName, last4: account.accountNumberLast4 }, ipAddress: req.ip });
  return res.status(201).json({ account: { ...account, maskedAccountNumber: `•••• ${account.accountNumberLast4}` } });
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const accountId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!accountId) return res.status(400).json({ message: "Identificador de cuenta inválido." });
  const input = baseSchema.partial().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "No se recibieron cambios válidos." });
  const current = await prisma.bankAccount.findFirst({ where: { id: accountId, organizationId: auth.organizationId } });
  if (!current) return res.status(404).json({ message: "Cuenta bancaria no encontrada." });
  const { accountNumber, ...plain } = input.data;
  const sensitive: { accountNumberEncrypted: string; accountNumberLast4: string; accountFingerprint: string } | undefined = accountNumber ? (() => {
    const normalized = normalizeAccount(accountNumber);
    if (!/^[A-Z0-9]{8,34}$/.test(normalized)) return undefined;
    return { accountNumberEncrypted: encryptField(normalized), accountNumberLast4: normalized.slice(-4), accountFingerprint: fingerprintField(normalized) };
  })() : undefined;
  if (accountNumber && !sensitive) return res.status(400).json({ message: "El número de cuenta contiene caracteres no válidos." });
  if (sensitive) {
    const duplicate = await prisma.bankAccount.findUnique({ where: { organizationId_accountFingerprint: { organizationId: auth.organizationId, accountFingerprint: sensitive.accountFingerprint } } });
    if (duplicate && duplicate.id !== current.id) return res.status(409).json({ message: "Esa cuenta bancaria ya está registrada." });
  }
  const account = await prisma.bankAccount.update({ where: { id: current.id }, data: { ...plain, ...(sensitive || {}) }, select: publicSelect });
  await audit({ organizationId: auth.organizationId, userId: auth.id, action: "BANK_ACCOUNT_UPDATED", entityType: "BANK_ACCOUNT", entityId: account.id, detail: { active: account.active }, ipAddress: req.ip });
  return res.json({ account: { ...account, maskedAccountNumber: `•••• ${account.accountNumberLast4}` } });
}));

export default router;
