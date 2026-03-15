import prisma from "@/lib/prisma"
import { warmInstrumentSnapshots } from "@/lib/screener/service"

function parseArguments(argv: string[]) {
  const args = new Map<string, string | boolean>()

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith("--")) continue

    const [rawKey, inlineValue] = current.slice(2).split("=", 2)
    if (inlineValue !== undefined) {
      args.set(rawKey, inlineValue)
      continue
    }

    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      args.set(rawKey, next)
      index += 1
      continue
    }

    args.set(rawKey, true)
  }

  return args
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const symbols = typeof args.get("symbols") === "string"
    ? String(args.get("symbols"))
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    : undefined
  const maxSymbols = Number(args.get("max") ?? args.get("maxSymbols") ?? 120)
  const force = args.get("force") === true

  console.log("[Screener] Refreshing instrument snapshots...")
  console.log(
    JSON.stringify(
      {
        symbols: symbols?.length ? symbols : null,
        maxSymbols: Number.isFinite(maxSymbols) ? maxSymbols : 120,
        force,
      },
      null,
      2
    )
  )

  await warmInstrumentSnapshots({
    symbols,
    maxSymbols: Number.isFinite(maxSymbols) ? maxSymbols : 120,
    force,
  })

  const [instrumentCount, metricCount, freshCount] = await Promise.all([
    prisma.instrumentMaster.count(),
    prisma.instrumentMetricSnapshot.count(),
    prisma.instrumentMetricSnapshot.count({
      where: {
        asOf: {
          gte: new Date(Date.now() - 12 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  console.log("[Screener] Snapshot refresh complete.")
  console.log(
    JSON.stringify(
      {
        instrumentCount,
        metricCount,
        freshCountLast12Hours: freshCount,
      },
      null,
      2
    )
  )
}

void main()
  .catch((error) => {
    console.error("[Screener] Snapshot refresh failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
