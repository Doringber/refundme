import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyBytes(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM. Output is not a JWT and contains no `eyJ` prefix. */
export function encryptSessionToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(secret), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSessionToken(payload: string, secret: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("BAD_SESSION_CIPHER");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(secret),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

export function sessionEncryptionSecret(): string | undefined {
  return process.env.BUYME_SESSION_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}
