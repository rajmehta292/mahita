import React, { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'

interface RenderAppOptions extends Omit<RenderOptions, 'wrapper'> {
    session?: Session | null
}

function AppProviders({
    children,
    session,
}: {
    children: ReactNode
    session?: Session | null
}) {
    return <SessionProvider session={session ?? null}>{children}</SessionProvider>
}

export function renderApp(ui: ReactElement, options: RenderAppOptions = {}) {
    const { session, ...renderOptions } = options

    return render(ui, {
        wrapper: ({ children }) => <AppProviders session={session}>{children}</AppProviders>,
        ...renderOptions,
    })
}
