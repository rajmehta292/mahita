import { NextRequest, NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import prisma from "@/lib/prisma"
import { upsertScreenerPreset } from "@/lib/screener/service"
import type { ScreenerPresetDocument } from "@/lib/screener/types"

export async function GET() {
  const session = await getAppServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const presets = await prisma.screenerPreset.findMany({
    where: { userId: session.user.id },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  })

  return NextResponse.json({
    success: true,
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      groupTab: preset.groupTab,
      resultTab: preset.resultTab,
      orderKey: preset.orderKey,
      orderDirection: preset.orderDirection,
      signal: preset.signal,
      filters: JSON.parse(preset.filtersJson || "[]"),
      updatedAt: preset.updatedAt.toISOString(),
    })),
  })
}

export async function POST(request: NextRequest) {
  const session = await getAppServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as ScreenerPresetDocument
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Preset name is required" }, { status: 400 })
  }

  const preset = await upsertScreenerPreset(session.user.id, {
    ...body,
    name: body.name.trim(),
  })

  return NextResponse.json({
    success: true,
    preset: {
      id: preset.id,
      name: preset.name,
      groupTab: preset.groupTab,
      resultTab: preset.resultTab,
      orderKey: preset.orderKey,
      orderDirection: preset.orderDirection,
      signal: preset.signal,
      filters: JSON.parse(preset.filtersJson || "[]"),
      updatedAt: preset.updatedAt.toISOString(),
    },
  })
}
