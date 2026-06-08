import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_VERSION = "v1";
const IV_BYTES = 12;

function getCredentialKey() {
  const rawKey = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is required");
  }

  const key = Buffer.from(rawKey, "base64");
  if (key.length === 32) return key;

  if (rawKey.length >= 32) {
    return createHash("sha256").update(rawKey).digest();
  }

  throw new Error("CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters or a 32-byte base64 value");
}

export function encryptCredential(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getCredentialKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptCredential(encrypted: string) {
  const [version, iv, tag, ciphertext] = encrypted.split(".");
  if (version !== ENCRYPTION_VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted credential payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getCredentialKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function fingerprintCredential(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

