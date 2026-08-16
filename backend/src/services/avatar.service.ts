export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function isValidAvatar(buffer: Buffer, mimeType: string) {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(mimeType as (typeof ALLOWED_AVATAR_MIME_TYPES)[number])) return false;
  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) return false;

  if (mimeType === "image/jpeg") return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}
