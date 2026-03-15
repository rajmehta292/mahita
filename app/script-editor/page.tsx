import { Suspense } from 'react'
import { ScriptEditorWorkspace } from '@/app/components/ScriptEditor/ScriptEditorWorkspace'

export default function ScriptEditorPage() {
    return (
        <Suspense fallback={null}>
            <ScriptEditorWorkspace />
        </Suspense>
    )
}
