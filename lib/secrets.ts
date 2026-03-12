import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const SECRET_PREFIX = "enc:v1:"
const IV_BYTES = 12

function getSecretKey() {
  const source =
    process.env.MAHITA_SECRET_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET

  if (!source) {
    throw new Error(
      "Secret encryption requires MAHITA_SECRET_KEY, ENCRYPTION_KEY, or NEXTAUTH_SECRET to be configured."
    )
  }

  return createHash("sha256").update(source).digest()
}

function encodeBuffer(value: Buffer) {
  return value.toString("base64")
}

function decodeBuffer(value: string) {
  return Buffer.from(value, "base64")
}

export function isEncryptedSecret(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX)
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) {
    return value ?? null
  }

  if (isEncryptedSecret(value)) {
    return value
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", getSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${SECRET_PREFIX}${encodeBuffer(iv)}.${encodeBuffer(encrypted)}.${encodeBuffer(authTag)}`
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return value ?? null
  }

  if (!isEncryptedSecret(value)) {
    return value
  }

  const payload = value.slice(SECRET_PREFIX.length)
  const [ivPart, encryptedPart, authTagPart] = payload.split(".")

  if (!ivPart || !encryptedPart || !authTagPart) {
    throw new Error("Encrypted secret payload is malformed.")
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getSecretKey(),
    decodeBuffer(ivPart)
  )

  decipher.setAuthTag(decodeBuffer(authTagPart))

  return Buffer.concat([
    decipher.update(decodeBuffer(encryptedPart)),
    decipher.final(),
  ]).toString("utf8")
}
