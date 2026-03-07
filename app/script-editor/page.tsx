import { MainLayout } from '../components/Layout/MainLayout'

export default function ScriptEditorPage() {
    return (
        <MainLayout>
            <div className="flex flex-col h-full text-white p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-2">Script Editor (Pineify Inspired)</h1>
                    <p className="text-gray-400">
                        Create custom indicators and strategies visually without coding skills.
                        Generate Pine Script v6 compatible code directly for TradingView integration,
                        or use it for internal backtesting.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                    {/* Left panel - Visual Builder */}
                    <div className="bg-[#1E222D] rounded-lg border border-[#2A2E39] p-4 col-span-1 lg:col-span-2 flex flex-col items-center justify-center">
                        <p className="text-gray-500">Visual Script Builder Area</p>
                        <p className="text-sm text-gray-600 mt-2">Select indicators, conditions, alerts, etc.</p>
                    </div>

                    {/* Right panel - Code Output */}
                    <div className="bg-[#131722] rounded-lg border border-[#2A2E39] p-4 flex flex-col font-mono text-sm">
                        <div className="flex justify-between items-center mb-4 border-b border-[#2A2E39] pb-2">
                            <span className="text-gray-300">Generated Code</span>
                            <button className="text-blue-500 hover:text-blue-400 text-xs">Copy</button>
                        </div>
                        <div className="flex-1 text-gray-400 overflow-y-auto">
                            {`// This source code is subject to the terms of the Mozilla Public License 2.0
// © Mahita

//@version=6
indicator("My Custom Script")

// Generated code will appear here`}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
