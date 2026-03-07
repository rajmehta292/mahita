import { MainLayout } from '../components/Layout/MainLayout'

export default function PortfolioPage() {
    return (
        <MainLayout>
            <div className="flex flex-col items-center justify-center h-full text-white">
                <h1 className="text-2xl font-bold mb-4">Portfolio</h1>
                <p className="text-gray-400">View your current holdings and account performance.</p>
                <div className="mt-8 text-sm text-gray-500">Under Construction</div>
            </div>
        </MainLayout>
    )
}
