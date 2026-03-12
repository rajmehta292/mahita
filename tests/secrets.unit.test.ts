import { afterEach, describe, expect, it } from 'vitest'
import {
    decryptSecret,
    encryptSecret,
    isEncryptedSecret,
} from '@/lib/secrets'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
    for (const key of Object.keys(process.env)) {
        if (!(key in ORIGINAL_ENV)) {
            delete process.env[key]
        }
    }

    Object.assign(process.env, ORIGINAL_ENV)
})

describe('secret encryption', () => {
    it('round-trips encrypted secrets with the configured master key', () => {
        process.env.MAHITA_SECRET_KEY = 'mahita-test-master-key'

        const encrypted = encryptSecret('super-secret-value')

        expect(encrypted).toMatch(/^enc:v1:/)
        expect(isEncryptedSecret(encrypted)).toBe(true)
        expect(decryptSecret(encrypted)).toBe('super-secret-value')
    })

    it('keeps plaintext compatibility for migration reads', () => {
        process.env.MAHITA_SECRET_KEY = 'mahita-test-master-key'

        expect(isEncryptedSecret('plain-text-token')).toBe(false)
        expect(decryptSecret('plain-text-token')).toBe('plain-text-token')
    })

    it('falls back to ENCRYPTION_KEY when a dedicated Mahita key is not set', () => {
        delete process.env.MAHITA_SECRET_KEY
        process.env.ENCRYPTION_KEY = 'shared-app-encryption-key'

        const encrypted = encryptSecret('secondary-secret')

        expect(isEncryptedSecret(encrypted)).toBe(true)
        expect(decryptSecret(encrypted)).toBe('secondary-secret')
    })
})
