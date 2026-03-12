import { MainLayout } from '../components/Layout/MainLayout'
import { HardDriveDownload, LockKeyhole, MonitorSmartphone, FolderCog } from 'lucide-react'

const pillars = [
    {
        icon: LockKeyhole,
        title: 'Encrypted Mahita Cache',
        description: 'Future desktop builds will keep performance-oriented market data in an encrypted local Mahita cache rather than exposing raw provider files directly.'
    },
    {
        icon: FolderCog,
        title: 'Readable Export Folder',
        description: 'Downloads the user explicitly requests will still land in a normal readable folder separate from the encrypted Mahita cache.'
    },
    {
        icon: MonitorSmartphone,
        title: 'Multi-window Desktop Workflow',
        description: 'The MAUI track is designed for a richer desktop shell with multiple windows, tighter chart/backtest workflows, and optional helper integration.'
    },
]

export default function DesktopExpansionPage() {
    return (
        <MainLayout>
            <div className="flex-1 overflow-auto bg-[#131722]">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                    <section className="rounded-[32px] border border-[#2A2E39] bg-gradient-to-br from-[#1E222D] to-[#10131A] p-8 shadow-2xl">
                        <div className="mb-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-blue-400">
                            <HardDriveDownload className="h-4 w-4" />
                            Desktop Expansion
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Mahita desktop acceleration is planned, not faked</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400">
                            This page is the public contract for the desktop track in the recovery program. The current web app remains fully usable without any local helper,
                            while the future MAUI build will add an encrypted Mahita cache, a separate readable export folder, and richer multi-window workflows.
                        </p>
                    </section>

                    <div className="grid gap-6 md:grid-cols-3">
                        {pillars.map((pillar) => {
                            const Icon = pillar.icon
                            return (
                                <section key={pillar.title} className="rounded-[28px] border border-[#2A2E39] bg-[#1E222D] p-6 shadow-xl">
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-lg font-black tracking-tight text-white">{pillar.title}</h2>
                                    <p className="mt-3 text-sm leading-6 text-gray-400">{pillar.description}</p>
                                </section>
                            )
                        })}
                    </div>

                    <section className="rounded-[28px] border border-[#2A2E39] bg-[#1E222D] p-8 shadow-xl">
                        <div className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Current Release Boundary</div>
                        <ul className="space-y-3 text-sm leading-6 text-gray-300">
                            <li>The current web release does not require a local folder binding.</li>
                            <li>The encrypted local Mahita cache will arrive with the future desktop helper, not as a fake web-only placeholder.</li>
                            <li>Readable Schwab exports will remain separate from the encrypted Mahita cache.</li>
                            <li>The future desktop app is targeted for .NET MAUI with an optional helper bridge.</li>
                        </ul>
                    </section>
                </div>
            </div>
        </MainLayout>
    )
}
