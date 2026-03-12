import { describe, expect, it } from 'vitest'
import { GOOGLE_PROVIDER_OPTIONS } from '@/lib/auth'

describe('authOptions', () => {
  it('enables Google email account linking for public-origin sign-in', async () => {
    expect(GOOGLE_PROVIDER_OPTIONS.allowDangerousEmailAccountLinking).toBe(true)
  })
})
