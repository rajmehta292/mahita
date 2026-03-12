'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { normalizeUnknownError } from '@/lib/app-errors'

interface ClientPaneErrorBoundaryProps {
  children: React.ReactNode
  title?: string
  message?: string
}

interface ClientPaneErrorBoundaryState {
  errorMessage: string | null
}

export class ClientPaneErrorBoundary extends React.Component<
  ClientPaneErrorBoundaryProps,
  ClientPaneErrorBoundaryState
> {
  state: ClientPaneErrorBoundaryState = {
    errorMessage: null,
  }

  static getDerivedStateFromError(error: unknown): ClientPaneErrorBoundaryState {
    const normalized = normalizeUnknownError(error, "Mahita could not render this panel.")
    return {
      errorMessage: normalized.message,
    }
  }

  componentDidCatch(error: unknown) {
    console.warn("[ClientPaneErrorBoundary]", error)
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-[#11141c] text-white">
          <div className="max-w-md rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-rose-300" />
            <p className="mt-3 text-sm font-medium">
              {this.props.title || "Panel unavailable"}
            </p>
            <p className="mt-2 text-sm text-rose-100/80">
              {this.state.errorMessage || this.props.message || "Try refreshing this view."}
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
