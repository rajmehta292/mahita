import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { marketDataStore } from '@/app/services/market-data/store'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'
import { Timeframe } from '@/app/services/market-data/types'

interface DiffSample {
    time: number
    primaryClose: number
    secondaryClose: number
    closeDiff: number
    primaryVolume: number
    secondaryVolume: number
    volumeDiff: number
}

function compareBars(primaryBars: any[], secondaryBars: any[]) {
    const primaryMap = new Map(primaryBars.map((bar) => [bar.time, bar]))
    const secondaryMap = new Map(secondaryBars.map((bar) => [bar.time, bar]))
    const allTimes = [...new Set([...primaryMap.keys(), ...secondaryMap.keys()])].sort((a, b) => a - b)

    let overlapCount = 0
    let mismatchCount = 0
    let maxCloseDiff = 0
    let avgCloseDiff = 0
    const samples: DiffSample[] = []

    for (const time of allTimes) {
        const primary = primaryMap.get(time)
        const secondary = secondaryMap.get(time)

        if (!primary || !secondary) {
            continue
        }

        overlapCount += 1
        const closeDiff = Math.abs(primary.close - secondary.close)
        const volumeDiff = Math.abs(primary.volume - secondary.volume)
        const priceTolerance = Math.max(0.01, Math.abs(primary.close) * 0.0001)
        const volumeTolerance = Math.max(1, Math.abs(primary.volume) * 0.01)

        maxCloseDiff = Math.max(maxCloseDiff, closeDiff)
        avgCloseDiff += closeDiff

        if (closeDiff > priceTolerance || volumeDiff > volumeTolerance) {
            mismatchCount += 1
            if (samples.length < 20) {
                samples.push({
                    time,
                    primaryClose: primary.close,
                    secondaryClose: secondary.close,
                    closeDiff,
                    primaryVolume: primary.volume,
                    secondaryVolume: secondary.volume,
                    volumeDiff
                })
            }
        }
    }

    return {
        overlapCount,
        missingFromPrimary: secondaryBars.length - overlapCount,
        missingFromSecondary: primaryBars.length - overlapCount,
        mismatchCount,
        maxCloseDiff,
        avgCloseDiff: overlapCount > 0 ? avgCloseDiff / overlapCount : 0,
        accuracyScore: allTimes.length === 0 ? 0 : Math.max(0, ((overlapCount - mismatchCount) / allTimes.length) * 100),
        samples
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const symbol = body.symbol?.trim()?.toUpperCase()
    const timeframe = body.timeframe as Timeframe
    const primaryProvider = body.primaryProvider?.trim()?.toLowerCase()
    const secondaryProvider = body.secondaryProvider?.trim()?.toLowerCase()
    const startTime = Number(body.startTime)
    const endTime = Number(body.endTime)

    if (!symbol || !timeframe || !primaryProvider || !secondaryProvider || !Number.isFinite(startTime) || !Number.isFinite(endTime)) {
        return NextResponse.json({ error: 'Missing verification parameters' }, { status: 400 })
    }

    if (primaryProvider === secondaryProvider) {
        return NextResponse.json({ error: 'Primary and secondary providers must differ' }, { status: 400 })
    }

    try {
        const [primaryBars, secondaryBars] = await Promise.all([
            marketDataStore.fetchProviderBars(primaryProvider, symbol, timeframe, startTime, endTime),
            marketDataStore.fetchProviderBars(secondaryProvider, symbol, timeframe, startTime, endTime)
        ])

        const comparison = compareBars(primaryBars, secondaryBars)

        await providerTelemetryBus.log({
            kind: 'verification',
            provider: `${primaryProvider}->${secondaryProvider}`,
            symbol,
            timeframe,
            rangeStart: startTime,
            rangeEnd: endTime,
            message: `Verification completed for ${symbol} ${timeframe}.`,
            response: {
                primaryCount: primaryBars.length,
                secondaryCount: secondaryBars.length,
                overlapCount: comparison.overlapCount,
                mismatchCount: comparison.mismatchCount,
                accuracyScore: comparison.accuracyScore
            }
        })

        return NextResponse.json({
            symbol,
            timeframe,
            primaryProvider,
            secondaryProvider,
            rangeStart: startTime,
            rangeEnd: endTime,
            primaryCount: primaryBars.length,
            secondaryCount: secondaryBars.length,
            comparison
        })
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Verification failed'
        }, { status: 500 })
    }
}
