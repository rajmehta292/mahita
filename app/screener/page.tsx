import { ScreenerWorkspace } from '@/app/components/Screener/ScreenerWorkspace'

interface ScreenerPageProps {
    searchParams: Promise<{
        preset?: string
    }>
}

export default async function ScreenerPage({ searchParams }: ScreenerPageProps) {
    const params = await searchParams

    return <ScreenerWorkspace initialPreset={params.preset ?? null} />
}
