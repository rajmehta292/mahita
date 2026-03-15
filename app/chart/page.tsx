import { Suspense } from 'react'
import { ChartWorkspace } from '../components/Chart/ChartWorkspace'

export default function ChartPage() {
    return (
        <Suspense fallback={null}>
            <ChartWorkspace />
        </Suspense>
    )
}
