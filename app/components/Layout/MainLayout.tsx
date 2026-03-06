'use client'

import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomPanel } from './BottomPanel'

interface MainLayoutProps {
    children: ReactNode
    showBottomPanel?: boolean
}

export function MainLayout({ children, showBottomPanel = true }: MainLayoutProps) {
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131722]">
            <TopBar />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-hidden">
                    {children}
                </main>
            </div>
            {showBottomPanel && <BottomPanel />}
        </div>
    )
}
