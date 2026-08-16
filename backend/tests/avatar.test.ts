import assert from "node:assert/strict";
import test from "node:test";
import { isValidAvatar, MAX_AVATAR_BYTES } from "../src/services/avatar.service.js";

test("acepta firmas reales de JPG, PNG y WebP", () => {
  assert.equal(isValidAvatar(Buffer.from([0xff, 0xd8, 0xff, 0xdb]), "image/jpeg"), true);
  assert.equal(isValidAvatar(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(isValidAvatar(Buffer.from("RIFF0000WEBP", "ascii"), "image/webp"), true);
});

test("rechaza contenido disfrazado, tipos no permitidos y archivos grandes", () => {
  assert.equal(isValidAvatar(Buffer.from("no-es-una-imagen"), "image/png"), false);
  assert.equal(isValidAvatar(Buffer.from("<svg></svg>"), "image/svg+xml"), false);
  assert.equal(isValidAvatar(Buffer.alloc(MAX_AVATAR_BYTES + 1, 0xff), "image/jpeg"), false);
});
