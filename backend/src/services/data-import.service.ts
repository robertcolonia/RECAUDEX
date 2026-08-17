import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import { prisma } from "../config/database.js";

export const DATASET_TYPES = ["CLIENTS", "FIXED_PLANT", "MOBILE_PLANT", "PAYMENTS", "INVOICES", "CREDIT_NOTES"] as const;
export type DatasetType = typeof DATASET_TYPES[number];
type Row = Record<string, string>;

type Definition = {
  label: string;
  description: string;
  required: string[];
  preview: string[];
};

export const datasetDefinitions: Record<DatasetType, Definition> = {
  CLIENTS: { label: "Clientes B2B", description: "Maestra fiscal y comercial de clientes.", required: ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL"], preview: ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL", "SEGMENTO_PAIS", "SUNAT_ESTADO_CONTRIBUYENTE"] },
  FIXED_PLANT: { label: "Planta fija", description: "Servicios, cuentas y estado de la planta fija.", required: ["NUMERO_IDENTIFICACION_FISCAL", "COD_CLIENTE", "COD_CUENTA"], preview: ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL", "COD_CLIENTE", "COD_CUENTA", "STATUS_DESC"] },
  MOBILE_PLANT: { label: "Planta móvil", description: "Líneas, planes y estado de la planta móvil.", required: ["NUMERO_IDENTIFICACION_FISCAL", "COD_CLIENTE", "COD_CUENTA"], preview: ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL", "COD_CLIENTE", "COD_CUENTA", "ESTADO_LINEA"] },
  PAYMENTS: { label: "Pagos y recaudo", description: "Movimientos recibidos para identificación y conciliación.", required: ["NRO_IDENTIFICACION_FISCAL", "FECHA_PAGO", "MONTO_PAGADO"], preview: ["NRO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL", "FACTURA_AFECTADA", "FECHA_PAGO", "MONTO_PAGADO"] },
  INVOICES: { label: "Facturas", description: "Documentos emitidos, vencimiento y saldos.", required: ["NUMERO_IDENTIFICACION_FISCAL", "NRO_DOC_FISCAL", "FECHA_EMISION", "CHARGE_TOTAL_AMOUNT"], preview: ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL", "NRO_DOC_FISCAL", "FECHA_EMISION", "FECHA_VTO", "CHARGE_TOTAL_AMOUNT"] },
  CREDIT_NOTES: { label: "Notas de crédito", description: "Rebajas y documentos fiscales afectados.", required: ["NUMERO_IDENTIFICACION_FISCAL", "NRO_DOC_FISCAL", "FECHAEMISION", "MONTO"], preview: ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL", "NRO_DOC_FISCAL", "FACTURA_AFECTADA", "MONTO"] }
};

export type ImportIssue = { rowNumber: number; severity: "ERROR" | "WARNING"; code: string; message: string };
export type ValidatedRow = { rowNumber: number; values: Row; valid: boolean; issues: ImportIssue[] };
export type ImportPreview = {
  datasetType: DatasetType;
  fileName: string;
  fileType: "CSV" | "XLSX";
  checksum: string;
  headers: string[];
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  warningRows: number;
  duplicateImport: boolean;
  issues: ImportIssue[];
  sample: ValidatedRow[];
};

export class ImportInputError extends Error {
  status = 400;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function cellText(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim().slice(0, 5000);
}

function safeFileName(value: string) {
  return (value.split(/[\\/]/).pop() || "datos").replace(/[^\w.() -]/g, "_").slice(0, 180);
}

function decodeCsv(buffer: Buffer) {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}

function detectDelimiter(source: string) {
  const line = source.split(/\r?\n/).find((item) => item.trim()) || "";
  return ["|", ";", ",", "\t"].map((delimiter) => ({ delimiter, count: line.split(delimiter).length - 1 })).sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

async function parseFile(buffer: Buffer, fileName: string): Promise<{ rows: Row[]; headers: string[]; fileType: "CSV" | "XLSX" }> {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!buffer.length) throw new ImportInputError("El archivo está vacío.");
  if (buffer.length > 12 * 1024 * 1024) throw new ImportInputError("El archivo supera el límite de 12 MB.");

  if (extension === "csv") {
    const source = decodeCsv(buffer);
    const delimiter = detectDelimiter(source);
    let records: Record<string, unknown>[];
    try {
      records = parse(source, { columns: (columns) => columns.map(normalizeHeader), delimiter, bom: true, skip_empty_lines: true, trim: true, relax_column_count: true });
    } catch {
      throw new ImportInputError("El CSV no pudo interpretarse. Verifica delimitador, encabezados y comillas.");
    }
    const rows = records.map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [normalizeHeader(key), cellText(value)])));
    return { rows, headers: Object.keys(rows[0] || {}), fileType: "CSV" };
  }

  if (extension === "xlsx") {
    let matrix: unknown[][];
    try {
      matrix = await readSheet(buffer) as unknown[][];
    } catch {
      throw new ImportInputError("El XLSX no pudo interpretarse o está dañado.");
    }
    const headers = (matrix[0] || []).map(normalizeHeader);
    const rows = matrix.slice(1).filter((line) => line.some((cell) => cell !== null && cell !== "")).map((line) => Object.fromEntries(headers.map((header, index) => [header, cellText(line[index])])));
    return { rows, headers, fileType: "XLSX" };
  }

  throw new ImportInputError("Formato no permitido. Utiliza un archivo .csv o .xlsx.");
}

function parseDate(value: string) {
  if (!value) return null;
  if (/^\d{8}$/.test(value)) return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 20_000 && numeric < 100_000) return new Date(Date.UTC(1899, 11, 30) + numeric * 86_400_000);
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseMoney(value: string) {
  let source = String(value || "").replace(/\s|S\/|\$/gi, "");
  if (source.includes(",") && source.includes(".")) source = source.lastIndexOf(",") > source.lastIndexOf(".") ? source.replaceAll(".", "").replace(",", ".") : source.replaceAll(",", "");
  else if (source.includes(",")) source = source.replace(",", ".");
  const parsed = Number(source);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function fingerprint(...values: unknown[]) {
  return createHash("sha256").update(values.join("|")).digest("hex").slice(0, 28);
}

export function validateDatasetRows(type: DatasetType, rows: Row[], headers: string[], knownCustomers = new Set<string>()) {
  const issues: ImportIssue[] = [];
  const missing = datasetDefinitions[type].required.filter((column) => !headers.includes(column));
  for (const column of missing) issues.push({ rowNumber: 0, severity: "ERROR", code: "MISSING_COLUMN", message: `Falta la columna obligatoria ${column}.` });
  if (rows.length > 20_000) issues.push({ rowNumber: 0, severity: "ERROR", code: "ROW_LIMIT", message: "El archivo supera el límite de 20,000 registros por importación." });

  const seenDocuments = new Set<string>();
  const seenCustomers = new Set<string>();
  const validated = rows.slice(0, 20_000).map((values, index): ValidatedRow => {
    const rowNumber = index + 2;
    const rowIssues: ImportIssue[] = [];
    const taxKey = type === "PAYMENTS" ? "NRO_IDENTIFICACION_FISCAL" : "NUMERO_IDENTIFICACION_FISCAL";
    const taxId = values[taxKey] || "";
    const error = (code: string, message: string) => rowIssues.push({ rowNumber, severity: "ERROR", code, message });
    const warning = (code: string, message: string) => rowIssues.push({ rowNumber, severity: "WARNING", code, message });

    if (!/^\d{8,20}$/.test(taxId)) error("INVALID_TAX_ID", "El identificador fiscal está vacío o no tiene un formato válido.");
    if (type === "CLIENTS") {
      if (!values.RAZON_SOCIAL) error("MISSING_LEGAL_NAME", "La razón social es obligatoria.");
      if (seenCustomers.has(taxId)) warning("DUPLICATE_ROW", "El cliente aparece más de una vez en el archivo; se conservará un registro.");
      seenCustomers.add(taxId);
    } else if (type !== "PAYMENTS" && taxId && !knownCustomers.has(taxId)) {
      error("CUSTOMER_NOT_FOUND", "El cliente no existe en la organización; importa primero la maestra de clientes.");
    } else if (type === "PAYMENTS" && taxId && !knownCustomers.has(taxId)) {
      warning("PAYER_NOT_IDENTIFIED", "El RUC no está en la maestra; el pago se importará como pagador por identificar.");
    }

    if ((type === "FIXED_PLANT" || type === "MOBILE_PLANT") && !values.COD_CUENTA) error("MISSING_ACCOUNT", "El código de cuenta es obligatorio.");
    if (type === "PAYMENTS") {
      const amount = parseMoney(values.MONTO_PAGADO || "");
      if (amount === null || amount <= 0) error("INVALID_AMOUNT", "El monto pagado debe ser numérico y mayor que cero.");
      if (!parseDate(values.FECHA_PAGO || "")) error("INVALID_DATE", "La fecha de pago no tiene un formato válido.");
      if (!values.FACTURA_AFECTADA) warning("NO_INVOICE_REFERENCE", "El movimiento no declara factura; A3 deberá identificarla.");
    }
    if (type === "INVOICES" || type === "CREDIT_NOTES") {
      const document = values.NRO_DOC_FISCAL || "";
      if (!document) error("MISSING_DOCUMENT", "El número de documento fiscal es obligatorio.");
      if (seenDocuments.has(document)) error("DUPLICATE_DOCUMENT", "El documento aparece repetido dentro del archivo.");
      seenDocuments.add(document);
      const date = parseDate(type === "INVOICES" ? values.FECHA_EMISION || "" : values.FECHAEMISION || "");
      if (!date) error("INVALID_DATE", "La fecha de emisión no tiene un formato válido.");
      const amount = parseMoney(type === "INVOICES" ? values.CHARGE_TOTAL_AMOUNT || "" : values.MONTO || "");
      if (amount === null || amount <= 0) error("INVALID_AMOUNT", "El importe debe ser numérico y mayor que cero.");
    }
    issues.push(...rowIssues);
    return { rowNumber, values, valid: !rowIssues.some((item) => item.severity === "ERROR") && missing.length === 0, issues: rowIssues };
  });
  return { validated, issues };
}

async function prepare(buffer: Buffer, fileNameInput: string, type: DatasetType, organizationId: string) {
  const fileName = safeFileName(fileNameInput);
  const parsed = await parseFile(buffer, fileName);
  if (!parsed.rows.length) throw new ImportInputError("El archivo no contiene registros para importar.");
  const customers = type === "CLIENTS" ? [] : await prisma.customer.findMany({ where: { organizationId }, select: { taxId: true } });
  const result = validateDatasetRows(type, parsed.rows, parsed.headers, new Set(customers.map((item) => item.taxId)));
  return { ...parsed, ...result, fileName, checksum: createHash("sha256").update(buffer).digest("hex") };
}

export async function previewDataImport(buffer: Buffer, fileName: string, type: DatasetType, organizationId: string): Promise<ImportPreview> {
  const prepared = await prepare(buffer, fileName, type, organizationId);
  const duplicateImport = Boolean(await prisma.dataImport.findUnique({ where: { organizationId_datasetType_checksum: { organizationId, datasetType: type, checksum: prepared.checksum } }, select: { id: true } }));
  const validRows = prepared.validated.filter((row) => row.valid).length;
  return {
    datasetType: type,
    fileName: prepared.fileName,
    fileType: prepared.fileType,
    checksum: prepared.checksum,
    headers: datasetDefinitions[type].preview.filter((header) => prepared.headers.includes(header)),
    totalRows: prepared.validated.length,
    validRows,
    rejectedRows: prepared.validated.length - validRows,
    warningRows: prepared.validated.filter((row) => row.issues.some((issue) => issue.severity === "WARNING")).length,
    duplicateImport,
    issues: prepared.issues.slice(0, 200),
    sample: prepared.validated.slice(0, 8)
  };
}

async function importValidatedRows(type: DatasetType, rows: ValidatedRow[], organizationId: string) {
  const valid = rows.filter((row) => row.valid);
  const customers = await prisma.customer.findMany({ where: { organizationId }, select: { id: true, taxId: true } });
  const customerIds = new Map(customers.map((customer) => [customer.taxId, customer.id]));

  if (type === "CLIENTS") {
    const unique = new Map(valid.map(({ values }) => [values.NUMERO_IDENTIFICACION_FISCAL, values]));
    return (await prisma.customer.createMany({ data: [...unique.values()].map((row) => ({ organizationId, taxId: row.NUMERO_IDENTIFICACION_FISCAL!, legalName: row.RAZON_SOCIAL!, segment: row.SEGMENTO_PAIS || null, status: row.SUNAT_ESTADO_CONTRIBUYENTE || row.SUNAT_ESTADO_RUC || null, department: row.SUNAT_DEPARTAMENTO || null, province: row.SUNAT_PROVINCIA || null, district: row.SUNAT_DISTRITO || null })), skipDuplicates: true })).count;
  }

  if (type === "FIXED_PLANT" || type === "MOBILE_PLANT") {
    const existing = await prisma.serviceAsset.findMany({ where: { organizationId, serviceType: type === "FIXED_PLANT" ? "FIXED" : "MOBILE" }, select: { customerId: true, customerCode: true, accountCode: true } });
    const keys = new Set(existing.map((item) => `${item.customerId}|${item.customerCode || ""}|${item.accountCode || ""}`));
    const data = valid.flatMap(({ values }) => {
      const customerId = customerIds.get(values.NUMERO_IDENTIFICACION_FISCAL!);
      if (!customerId) return [];
      const key = `${customerId}|${values.COD_CLIENTE || ""}|${values.COD_CUENTA || ""}`;
      if (keys.has(key)) return [];
      keys.add(key);
      return [{ organizationId, customerId, customerCode: values.COD_CLIENTE || null, accountCode: values.COD_CUENTA || null, serviceType: type === "FIXED_PLANT" ? "FIXED" : "MOBILE", status: type === "FIXED_PLANT" ? values.STATUS_DESC || values.INT_SUBSCRIBER_STATUS_DESC || null : values.ESTADO_LINEA || null, attributes: values }];
    });
    return (await prisma.serviceAsset.createMany({ data })).count;
  }

  if (type === "PAYMENTS") {
    const data = valid.map(({ values, rowNumber }) => {
      const taxId = values.NRO_IDENTIFICACION_FISCAL || "";
      const externalId = values.NUMERO_OPERACION || values.NRO_OPERACION || `PAG-${fingerprint(taxId, values.COD_CUENTA, values.FACTURA_AFECTADA, values.FECHA_PAGO, values.MONTO_PAGADO, rowNumber)}`;
      return { organizationId, customerId: customerIds.get(taxId) || null, externalId, bankOperation: values.NUMERO_OPERACION || values.NRO_OPERACION || externalId, declaredInvoice: values.FACTURA_AFECTADA || null, customerCode: values.COD_CLIENTE || null, accountCode: values.COD_CUENTA || null, system: values.SISTEMA || null, paidAt: parseDate(values.FECHA_PAGO!)!, currency: values.MONEDA_FACTURA || values.MONEDA || "PEN", amount: parseMoney(values.MONTO_PAGADO!)!, status: "UNMATCHED" };
    });
    return (await prisma.payment.createMany({ data, skipDuplicates: true })).count;
  }

  if (type === "INVOICES") {
    const data = valid.flatMap(({ values }) => {
      const customerId = customerIds.get(values.NUMERO_IDENTIFICACION_FISCAL!);
      if (!customerId) return [];
      const total = parseMoney(values.CHARGE_TOTAL_AMOUNT!)!;
      return [{ organizationId, customerId, externalId: values.NRO_DOC_FISCAL!, customerCode: values.COD_CLIENTE || null, accountCode: values.COD_CUENTA || null, source: values.FUENTE || null, system: values.SISTEMA || null, issuedAt: parseDate(values.FECHA_EMISION!)!, dueAt: parseDate(values.FECHA_VTO || ""), currency: values.MONEDA || "PEN", netAmount: parseMoney(values.CHARGE_NET_AMOUNT || "") ?? total, taxAmount: parseMoney(values.CHARGE_IGV_INVOICE || "") ?? 0, totalAmount: total, openAmount: total, status: "OPEN" }];
    });
    return (await prisma.invoice.createMany({ data, skipDuplicates: true })).count;
  }

  const data = valid.flatMap(({ values }) => {
    const customerId = customerIds.get(values.NUMERO_IDENTIFICACION_FISCAL!);
    if (!customerId) return [];
    return [{ organizationId, customerId, externalId: values.NRO_DOC_FISCAL!, affectedInvoice: values.FACTURA_AFECTADA || null, customerCode: values.COD_CLIENTE || null, accountCode: values.COD_CUENTA || null, issuedAt: parseDate(values.FECHAEMISION!)!, currency: values.MONEDA || "PEN", amount: parseMoney(values.MONTO!)! }];
  });
  return (await prisma.creditNote.createMany({ data, skipDuplicates: true })).count;
}

export async function executeDataImport(buffer: Buffer, fileName: string, type: DatasetType, organizationId: string, userId: string) {
  const prepared = await prepare(buffer, fileName, type, organizationId);
  const headerErrors = prepared.issues.filter((issue) => issue.rowNumber === 0 && issue.severity === "ERROR");
  if (headerErrors.length) throw new ImportInputError(headerErrors.map((issue) => issue.message).join(" "));
  const validRows = prepared.validated.filter((row) => row.valid).length;
  if (!validRows) throw new ImportInputError("No existen registros válidos para importar.");
  const duplicate = await prisma.dataImport.findUnique({ where: { organizationId_datasetType_checksum: { organizationId, datasetType: type, checksum: prepared.checksum } } });
  if (duplicate) throw Object.assign(new ImportInputError("Este mismo archivo ya fue importado para el tipo seleccionado."), { status: 409 });

  const importedRows = await importValidatedRows(type, prepared.validated, organizationId);
  const rejectedRows = prepared.validated.length - validRows;
  const record = await prisma.dataImport.create({ data: { organizationId, userId, datasetType: type, fileName: prepared.fileName, fileType: prepared.fileType, checksum: prepared.checksum, totalRows: prepared.validated.length, validRows, importedRows, rejectedRows, status: rejectedRows ? "COMPLETED_WITH_WARNINGS" : "COMPLETED", summary: { skippedRows: validRows - importedRows, warnings: prepared.issues.filter((issue) => issue.severity === "WARNING").length, errors: prepared.issues.filter((issue) => issue.severity === "ERROR").length } } });
  return { record, issues: prepared.issues.slice(0, 200) };
}
