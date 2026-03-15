export type SchwabPopupStage = 'redirecting' | 'processing' | 'error'

export type SchwabPopupSignal =
  | {
      type: 'schwab-auth-stage'
      stage: SchwabPopupStage
      error?: string
    }
  | {
      type: 'schwab-auth-complete'
      success: boolean
      error?: string
    }

const SCHWAB_POPUP_CHANNEL_NAME = 'mahita.schwab.popup'
const SCHWAB_POPUP_SIGNAL_STORAGE_KEY = 'mahita.schwab.popup.signal'
const SCHWAB_POPUP_FLOW_STORAGE_KEY = 'mahita.schwab.popup.flow'

type BroadcastChannelLike = {
  close?: () => void
  addEventListener?: (type: 'message', listener: (event: MessageEvent<SchwabPopupSignal>) => void) => void
  removeEventListener?: (type: 'message', listener: (event: MessageEvent<SchwabPopupSignal>) => void) => void
  onmessage?: ((event: MessageEvent<SchwabPopupSignal>) => void) | null
  postMessage: (message: SchwabPopupSignal) => void
}

function createBroadcastChannel(): BroadcastChannelLike | null {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') {
    return null
  }

  try {
    return new window.BroadcastChannel(SCHWAB_POPUP_CHANNEL_NAME) as BroadcastChannelLike
  } catch (error) {
    console.warn('Failed to create Schwab popup BroadcastChannel:', error)
    return null
  }
}

export function markSchwabPopupFlow() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(SCHWAB_POPUP_FLOW_STORAGE_KEY, 'popup')
  } catch (error) {
    console.warn('Failed to mark Schwab popup flow:', error)
  }
}

export function hasSchwabPopupFlowMarker() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.sessionStorage.getItem(SCHWAB_POPUP_FLOW_STORAGE_KEY) === 'popup'
  } catch {
    return false
  }
}

export function emitSchwabPopupSignal(signal: SchwabPopupSignal) {
  if (typeof window === 'undefined') {
    return
  }

  const broadcastChannel = createBroadcastChannel()
  try {
    broadcastChannel?.postMessage(signal)
  } catch (error) {
    console.warn('Failed to broadcast Schwab popup signal:', error)
  } finally {
    broadcastChannel?.close?.()
  }

  try {
    const payload = JSON.stringify({
      ...signal,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).slice(2),
    })
    window.localStorage.setItem(SCHWAB_POPUP_SIGNAL_STORAGE_KEY, payload)
    window.localStorage.removeItem(SCHWAB_POPUP_SIGNAL_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to persist Schwab popup signal fallback:', error)
  }
}

export function subscribeToSchwabPopupSignals(
  onSignal: (signal: SchwabPopupSignal) => void
) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const broadcastChannel = createBroadcastChannel()
  const handleBroadcastMessage = (event: MessageEvent<SchwabPopupSignal>) => {
    if (!event.data?.type) {
      return
    }

    onSignal(event.data)
  }

  if (broadcastChannel?.addEventListener) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage)
  } else if (broadcastChannel) {
    broadcastChannel.onmessage = handleBroadcastMessage
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SCHWAB_POPUP_SIGNAL_STORAGE_KEY || !event.newValue) {
      return
    }

    try {
      const payload = JSON.parse(event.newValue) as SchwabPopupSignal
      if (!payload?.type) {
        return
      }

      onSignal(payload)
    } catch (error) {
      console.warn('Failed to parse Schwab popup signal fallback:', error)
    }
  }

  window.addEventListener('storage', handleStorage)

  return () => {
    if (broadcastChannel?.removeEventListener) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage)
    } else if (broadcastChannel) {
      broadcastChannel.onmessage = null
    }
    broadcastChannel?.close?.()
    window.removeEventListener('storage', handleStorage)
  }
}
