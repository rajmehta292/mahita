import { describe, expect, it } from 'vitest'
import { normalizeUnknownError } from '@/lib/app-errors'

describe('normalizeUnknownError', () => {
  it('turns Event objects into readable app errors', () => {
    const error = normalizeUnknownError(new Event('error'), 'Mahita hit an unexpected error.')

    expect(error.message).toBe('Mahita hit an unexpected error.')
    expect(error.details).toMatchObject({ eventType: 'error' })
  })

  it('uses message-bearing objects instead of stringifying them as [object Object]', () => {
    const error = normalizeUnknownError({ message: 'Something broke', type: 'worker' })

    expect(error.message).toBe('Something broke')
    expect(error.details).toMatchObject({ rawType: 'worker' })
  })

  it('turns event-like objects into readable app errors instead of [object Event]', () => {
    const error = normalizeUnknownError({ type: 'error', isTrusted: true }, 'Monaco failed to initialize.')

    expect(error.message).toBe('Monaco failed to initialize.')
    expect(error.details).toMatchObject({ eventType: 'error', isTrusted: true })
  })
})
