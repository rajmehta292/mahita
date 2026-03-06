import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ScriptCompiler } from "@/app/services/trading-engine/script-engine"

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { script } = await req.json()

        if (!script) {
            return NextResponse.json({ error: "No script provided" }, { status: 400 })
        }

        try {
            ScriptCompiler.compile(script)
            return NextResponse.json({ success: true, message: "Script compiled successfully." })
        } catch (e: any) {
            return NextResponse.json({
                success: false,
                error: e.message || "Compilation failed",
                details: e.stack
            }, { status: 422 })
        }
    } catch (error) {
        console.error("Compile Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
