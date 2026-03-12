'use client'

import { ReactNode, useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomPanel } from './BottomPanel'
import { SessionActivityTracker } from '@/app/components/Auth/SessionActivityTracker'

interface MainLayoutProps {
    children: ReactNode
    showBottomPanel?: boolean
}

export function MainLayout({ children, showBottomPanel = true }: MainLayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131722]">
            <SessionActivityTracker />
            <TopBar onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    isOpen={isMobileMenuOpen}
                    onClose={() => setIsMobileMenuOpen(false)}
                />
                <main className="flex-1 flex flex-col overflow-hidden w-full">
                    {children}
                </main>
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </div>
            {showBottomPanel && <BottomPanel />}
        </div>
    )
}
