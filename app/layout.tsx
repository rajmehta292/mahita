import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Mahita Terminal',
    description: 'Algorithmic Trading & Backtesting Engine',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
