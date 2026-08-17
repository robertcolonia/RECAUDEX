import test from "node:test";
import assert from "node:assert/strict";
import { validateDatasetRows } from "../src/services/data-import.service.js";

test("valida una maestra de clientes y advierte duplicados dentro del archivo", () => {
  const headers = ["NUMERO_IDENTIFICACION_FISCAL", "RAZON_SOCIAL"];
  const rows = [
    { NUMERO_IDENTIFICACION_FISCAL: "20123456789", RAZON_SOCIAL: "Empresa Uno" },
    { NUMERO_IDENTIFICACION_FISCAL: "20123456789", RAZON_SOCIAL: "Empresa Uno duplicada" }
  ];
  const result = validateDatasetRows("CLIENTS", rows, headers);
  assert.equal(result.validated.filter((row) => row.valid).length, 2);
  assert.equal(result.issues.some((issue) => issue.code === "DUPLICATE_ROW" && issue.severity === "WARNING"), true);
});

test("rechaza facturas con cliente desconocido, monto o fecha inválidos", () => {
  const headers = ["NUMERO_IDENTIFICACION_FISCAL", "NRO_DOC_FISCAL", "FECHA_EMISION", "CHARGE_TOTAL_AMOUNT"];
  const rows = [{ NUMERO_IDENTIFICACION_FISCAL: "20123456789", NRO_DOC_FISCAL: "F001-1", FECHA_EMISION: "fecha", CHARGE_TOTAL_AMOUNT: "cien" }];
  const result = validateDatasetRows("INVOICES", rows, headers, new Set());
  assert.equal(result.validated[0]?.valid, false);
  assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set(["CUSTOMER_NOT_FOUND", "INVALID_DATE", "INVALID_AMOUNT"]));
});

test("acepta depósitos sin factura y conserva la advertencia para A3", () => {
  const headers = ["NRO_IDENTIFICACION_FISCAL", "FECHA_PAGO", "MONTO_PAGADO"];
  const rows = [{ NRO_IDENTIFICACION_FISCAL: "20999999999", FECHA_PAGO: "2026-08-16", MONTO_PAGADO: "1,250.50" }];
  const result = validateDatasetRows("PAYMENTS", rows, headers, new Set());
  assert.equal(result.validated[0]?.valid, true);
  assert.equal(result.issues.some((issue) => issue.code === "PAYER_NOT_IDENTIFIED"), true);
  assert.equal(result.issues.some((issue) => issue.code === "NO_INVOICE_REFERENCE"), true);
});

test("bloquea archivos que no incluyen sus columnas obligatorias", () => {
  const result = validateDatasetRows("CREDIT_NOTES", [{ NUMERO_IDENTIFICACION_FISCAL: "20123456789" }], ["NUMERO_IDENTIFICACION_FISCAL"], new Set(["20123456789"]));
  assert.equal(result.validated[0]?.valid, false);
  assert.equal(result.issues.filter((issue) => issue.code === "MISSING_COLUMN").length, 3);
});
