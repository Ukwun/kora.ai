import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const value = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY is required for WhatsApp token storage.");
  const buffer = Buffer.from(value, "base64");
  if (buffer.length !== 32) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return buffer;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Encrypted secret is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}
