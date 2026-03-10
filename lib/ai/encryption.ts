import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

export function encrypt(text: string) {
    const key = process.env.ENCRYPTION_KEY
    if (!key || key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)')
    }

    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag().toString('hex')

    return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string) {
    const key = process.env.ENCRYPTION_KEY
    if (!key || key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)')
    }

    const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}
