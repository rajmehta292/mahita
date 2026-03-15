import { Suspense } from 'react'
import { SuperChartWorkspace } from '@/app/components/SuperChart/SuperChartWorkspace'

export default function SuperChartPage() {
    return (
        <Suspense fallback={null}>
            <SuperChartWorkspace />
        </Suspense>
    )
}
