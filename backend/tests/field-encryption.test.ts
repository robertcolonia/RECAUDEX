import assert from "node:assert/strict";
import test from "node:test";
import { decryptField, encryptField, fingerprintField } from "../src/services/field-encryption.service.js";

test("cifra números bancarios sin exponer el valor original", () => {
  const accountNumber = "19112345678901234567";
  const encrypted = encryptField(accountNumber);
  assert.notEqual(encrypted, accountNumber);
  assert.equal(encrypted.includes(accountNumber), false);
  assert.equal(decryptField(encrypted), accountNumber);
});

test("genera una huella estable para detectar cuentas duplicadas", () => {
  assert.equal(fingerprintField("123456789"), fingerprintField("123456789"));
  assert.notEqual(fingerprintField("123456789"), fingerprintField("987654321"));
});
