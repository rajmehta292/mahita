import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { ScriptCompiler } from "@/app/services/trading-engine/script-engine"
import type { StrategyRunSettings } from '@/app/services/trading-engine/types'
import { validateWithPinets } from "@/app/services/trading-engine/pinets-series"

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { script, runSettings } = await req.json() as {
            script?: string
            runSettings?: Partial<StrategyRunSettings>
        }

        if (!script) {
            return NextResponse.json({ error: "No script provided" }, { status: 400 })
        }

        try {
            await validateWithPinets(script)
            const compiled = ScriptCompiler.compileDetailed(script)
            return NextResponse.json({
                success: true,
                engineMode: 'pinets',
                message: "Script validated against the PineTS-backed Mahita runtime.",
                diagnostics: {
                    normalizedScriptSource: compiled.normalizedScriptSource,
                    strategySettings: compiled.strategySettings,
                    activeRunSettings: ScriptCompiler.toRunSettings(
                        compiled.strategySettings,
                        runSettings ?? null,
                        runSettings ? 'saved-draft' : 'script-header'
                    ),
                },
            })
        } catch (e) {
            return NextResponse.json({
                success: false,
                error: e instanceof Error ? e.message : "Compilation failed",
                details: e instanceof Error ? e.stack : undefined
            }, { status: 422 })
        }
    } catch (error) {
        console.error("Compile Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
