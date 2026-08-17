import { raw, Router } from "express";
import { prisma } from "../config/database.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit } from "../services/audit.service.js";
import { DATASET_TYPES, datasetDefinitions, executeDataImport, previewDataImport, type DatasetType } from "../services/data-import.service.js";
import type { AuthenticatedRequest } from "../types.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const canImport = requireRoles("ADMIN", "DIRECTION", "BILLING", "COLLECTIONS", "RECONCILIATION", "FINANCE");
const binary = raw({ type: ["text/csv", "application/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"], limit: "12mb" });

function input(req: AuthenticatedRequest) {
  const datasetType = String(req.query.datasetType || "").toUpperCase() as DatasetType;
  if (!DATASET_TYPES.includes(datasetType)) throw Object.assign(new Error("Selecciona uno de los seis tipos de información permitidos."), { status: 400 });
  const fileName = decodeURIComponent(String(req.get("x-file-name") || "datos"));
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  return { datasetType, fileName, buffer };
}

router.get("/config", requireAuth, (_req, res) => {
  return res.json({ datasets: DATASET_TYPES.map((type) => ({ type, ...datasetDefinitions[type] })), limits: { bytes: 12 * 1024 * 1024, rows: 20_000 }, formats: ["CSV", "XLSX"] });
});

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { organizationId } = (req as AuthenticatedRequest).auth;
  const imports = await prisma.dataImport.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { fullName: true, email: true } } } });
  return res.json({ imports });
}));

router.put("/preview", requireAuth, canImport, binary, asyncHandler(async (req, res) => {
  const request = req as AuthenticatedRequest;
  const { datasetType, fileName, buffer } = input(request);
  return res.json({ preview: await previewDataImport(buffer, fileName, datasetType, request.auth.organizationId) });
}));

router.post("/commit", requireAuth, canImport, binary, asyncHandler(async (req, res) => {
  const request = req as AuthenticatedRequest;
  const { datasetType, fileName, buffer } = input(request);
  const result = await executeDataImport(buffer, fileName, datasetType, request.auth.organizationId, request.auth.id);
  await audit({ organizationId: request.auth.organizationId, userId: request.auth.id, action: "DATA_FILE_IMPORTED", entityType: "DATA_IMPORT", entityId: result.record.id, detail: { datasetType, fileName: result.record.fileName, fileType: result.record.fileType, totalRows: result.record.totalRows, importedRows: result.record.importedRows, rejectedRows: result.record.rejectedRows }, ipAddress: req.ip });
  return res.status(201).json(result);
}));

export default router;
