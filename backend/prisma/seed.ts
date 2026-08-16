import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { rankCandidates } from "../src/services/matching.service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL es obligatorio para sembrar la base de datos.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(currentDir, "../data/raw");

type Row = Record<string, string>;

function rows(file: string): Row[] {
  const source = readFileSync(resolve(dataDir, file)).toString("latin1");
  return parse(source, { columns: true, delimiter: "|", skip_empty_lines: true, trim: true, relax_column_count: true });
}

function asDate(value: string | undefined) {
  if (!value) return new Date("2000-01-01T00:00:00Z");
  if (/^\d{8}$/.test(value)) return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }
  const parsed = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isNaN(parsed.getTime()) ? new Date("2000-01-01T00:00:00Z") : parsed;
}

function money(value: string | undefined) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function fingerprint(...values: unknown[]) {
  return createHash("sha256").update(values.join("|")).digest("hex").slice(0, 28);
}

async function createInBatches<T>(items: T[], create: (batch: T[]) => Promise<unknown>, size = 750) {
  for (let index = 0; index < items.length; index += size) await create(items.slice(index, index + size));
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "integratel" },
    update: { name: "Integratel" },
    create: { name: "Integratel", slug: "integratel" }
  });

  const passwordHash = await bcrypt.hash(process.env.SEED_DEFAULT_PASSWORD || "recaudex2026", 12);
  const seedUsers = [
    ["dirección", "direccion@recaudex.app", "Dirección General", "DIRECTION"],
    ["facturación", "facturacion@recaudex.app", "Líder de Facturación", "BILLING"],
    ["cobranzas", "cobranzas@recaudex.app", "Líder de Cobranzas", "COLLECTIONS"],
    ["recaudo", "recaudo@recaudex.app", "Analista de Recaudo", "RECONCILIATION"],
    ["finanzas", "finanzas@recaudex.app", "Gerencia de Finanzas", "FINANCE"],
    ["analítica", "bi@recaudex.app", "Business Intelligence", "BI"]
  ] as const;
  for (const [, email, fullName, role] of seedUsers) {
    await prisma.user.upsert({
      where: { email },
      update: { organizationId: organization.id, fullName, role, active: true },
      create: { organizationId: organization.id, email, fullName, role, passwordHash }
    });
  }

  const existingInvoices = await prisma.invoice.count({ where: { organizationId: organization.id } });
  if (existingInvoices > 0) {
    console.log("Los datos SON-IA ya están cargados; se conservan los registros existentes.");
    return;
  }

  const clientRows = rows("001_TBL_CLIENTES_B2B.csv");
  const fixedRows = rows("002_TBL_PLANTA_FIJA_B2B.csv");
  const mobileRows = rows("003_TBL_PLANTA_MOVIL_B2B.csv");
  const paymentRows = rows("004_TBL_PAGOS_B2B.csv");
  const invoiceRows = rows("005_TBL_FACTURAS_B2B.csv");
  const creditRows = rows("006_TBL_NOTAS_CREDITO_B2B.csv");

  const sourceRows = [...clientRows, ...fixedRows, ...mobileRows, ...paymentRows, ...invoiceRows, ...creditRows];
  const customersByTax = new Map<string, Row>();
  for (const row of sourceRows) {
    const taxId = row.NUMERO_IDENTIFICACION_FISCAL || row.NRO_IDENTIFICACION_FISCAL;
    if (taxId && !customersByTax.has(taxId)) customersByTax.set(taxId, row);
  }
  await createInBatches([...customersByTax.entries()].map(([taxId, row]) => ({
    organizationId: organization.id,
    taxId,
    legalName: row.RAZON_SOCIAL || `Cliente ${taxId}`,
    segment: row.SEGMENTO_PAIS || null,
    status: row.SUNAT_ESTADO_RUC || row.SUNAT_ESTADO_CONTRIBUYENTE || null,
    department: row.SUNAT_DEPARTAMENTO || null,
    province: row.SUNAT_PROVINCIA || null,
    district: row.SUNAT_DISTRITO || null
  })), (data) => prisma.customer.createMany({ data, skipDuplicates: true }));

  const customers = await prisma.customer.findMany({ where: { organizationId: organization.id }, select: { id: true, taxId: true } });
  const customerId = new Map(customers.map((customer) => [customer.taxId, customer.id]));

  const assetData = [
    ...fixedRows.map((row) => ({ row, serviceType: "FIXED", status: row.STATUS_DESC || row.INT_SUBSCRIBER_STATUS_DESC || row.TV_SUBSCRIBER_STATUS_DESC })),
    ...mobileRows.map((row) => ({ row, serviceType: "MOBILE", status: row.ESTADO_LINEA }))
  ].flatMap(({ row, serviceType, status }) => {
    const id = customerId.get(row.NUMERO_IDENTIFICACION_FISCAL ?? "");
    return id ? [{ organizationId: organization.id, customerId: id, customerCode: row.COD_CLIENTE || null, accountCode: row.COD_CUENTA || null, serviceType, status: status || null, attributes: row }] : [];
  });
  await createInBatches(assetData, (data) => prisma.serviceAsset.createMany({ data }));

  const invoices = invoiceRows.flatMap((row) => {
    const id = customerId.get(row.NUMERO_IDENTIFICACION_FISCAL ?? "");
    if (!id || !row.NRO_DOC_FISCAL) return [];
    const total = money(row.CHARGE_TOTAL_AMOUNT);
    return [{ organizationId: organization.id, customerId: id, externalId: row.NRO_DOC_FISCAL, customerCode: row.COD_CLIENTE || null, accountCode: row.COD_CUENTA || null, source: row.FUENTE || null, system: row.SISTEMA || null, issuedAt: asDate(row.FECHA_EMISION), dueAt: asDate(row.FECHA_VTO), currency: row.MONEDA || "PEN", netAmount: money(row.CHARGE_NET_AMOUNT), taxAmount: money(row.CHARGE_IGV_INVOICE), totalAmount: total, openAmount: total, status: "OPEN" }];
  });
  await createInBatches(invoices, (data) => prisma.invoice.createMany({ data, skipDuplicates: true }));

  const payments = paymentRows.flatMap((row, index) => {
    const taxId = row.NRO_IDENTIFICACION_FISCAL;
    const id = customerId.get(taxId ?? "");
    const externalId = `PAG-${fingerprint(taxId, row.COD_CUENTA, row.FACTURA_AFECTADA, row.FECHA_PAGO, row.MONTO_PAGADO, index)}`;
    return [{ organizationId: organization.id, customerId: id || null, externalId, bankOperation: externalId, declaredInvoice: row.FACTURA_AFECTADA || null, customerCode: row.COD_CLIENTE || null, accountCode: row.COD_CUENTA || null, system: row.SISTEMA || null, paidAt: asDate(row.FECHA_PAGO), currency: row.MONEDA_FACTURA || "PEN", amount: money(row.MONTO_PAGADO), status: "UNMATCHED" }];
  });
  await createInBatches(payments, (data) => prisma.payment.createMany({ data, skipDuplicates: true }));

  const creditNotes = creditRows.flatMap((row) => {
    const id = customerId.get(row.NUMERO_IDENTIFICACION_FISCAL ?? "");
    if (!id || !row.NRO_DOC_FISCAL) return [];
    return [{ organizationId: organization.id, customerId: id, externalId: row.NRO_DOC_FISCAL, affectedInvoice: row.FACTURA_AFECTADA || null, customerCode: row.COD_CLIENTE || null, accountCode: row.COD_CUENTA || null, issuedAt: asDate(row.FECHAEMISION), currency: row.MONEDA || "PEN", amount: money(row.MONTO) }];
  });
  await createInBatches(creditNotes, (data) => prisma.creditNote.createMany({ data, skipDuplicates: true }));

  const paymentsForCases = await prisma.payment.findMany({ where: { organizationId: organization.id }, orderBy: { paidAt: "desc" }, take: 160 });
  for (const payment of paymentsForCases) {
    const possible = await prisma.invoice.findMany({
      where: { organizationId: organization.id, status: "OPEN", OR: [{ customerId: payment.customerId ?? "__none__" }, { accountCode: payment.accountCode ?? "__none__" }, { externalId: payment.declaredInvoice ?? "__none__" }] },
      take: 80
    });
    const candidates = rankCandidates(
      { amount: Number(payment.amount), paidAt: payment.paidAt, customerId: payment.customerId, accountCode: payment.accountCode, declaredInvoice: payment.declaredInvoice },
      possible.map((invoice) => ({ id: invoice.id, externalId: invoice.externalId, customerId: invoice.customerId, accountCode: invoice.accountCode, issuedAt: invoice.issuedAt, dueAt: invoice.dueAt, totalAmount: Number(invoice.totalAmount), openAmount: Number(invoice.openAmount) }))
    );
    if (!candidates.length) continue;
    const top = candidates[0]!;
    await prisma.reconciliationCase.create({ data: { organizationId: organization.id, paymentId: payment.id, status: top.score >= 0.85 ? "RECOMMENDED" : "REVIEW", confidence: top.score, candidates, rationale: `${Math.round(top.score * 100)}%: ${top.signals.join(", ")}.` } });
  }

  const recaudador = await prisma.user.findUnique({ where: { email: "recaudo@recaudex.app" } });
  const finance = await prisma.user.findUnique({ where: { email: "finanzas@recaudex.app" } });
  const sampleCases = await prisma.reconciliationCase.findMany({ where: { organizationId: organization.id }, orderBy: { confidence: "desc" }, take: 8 });
  if (recaudador && finance) {
    for (const [index, item] of sampleCases.entries()) {
      const approved = index < 3;
      await prisma.approval.create({ data: { organizationId: organization.id, caseId: item.id, requestedById: recaudador.id, decidedById: approved ? finance.id : null, status: approved ? "APPROVED" : "PENDING", decidedAt: approved ? new Date() : null, comment: approved ? "Validación de señales completada." : null } });
      await prisma.reconciliationCase.update({ where: { id: item.id }, data: { status: approved ? "APPROVED" : "PENDING_APPROVAL" } });
    }
  }

  await prisma.auditEvent.create({ data: { organizationId: organization.id, action: "DATASET_IMPORTED", entityType: "ORGANIZATION", entityId: organization.id, detail: { customers: customers.length, serviceAssets: assetData.length, invoices: invoices.length, payments: payments.length, creditNotes: creditNotes.length } } });
  console.log(`Carga completada: ${customers.length} clientes, ${invoices.length} facturas, ${payments.length} pagos.`);
}

main().finally(async () => prisma.$disconnect());
