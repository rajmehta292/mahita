#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const rootDir = process.cwd()
const prisma = new PrismaClient()

function parseArgs(argv) {
  const args = { output: null }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--output" && argv[index + 1]) {
      args.output = argv[index + 1]
      index += 1
    }
  }

  return args
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    return null
  }

  const rawPath = databaseUrl.replace(/^file:/, "")
  return path.isAbsolute(rawPath) ? rawPath : path.join(rootDir, rawPath)
}

async function getFileSummary(filePath) {
  try {
    const stats = await fs.stat(filePath)
    return {
      path: filePath,
      exists: true,
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    }
  } catch {
    return {
      path: filePath,
      exists: false,
      bytes: 0,
      modifiedAt: null,
    }
  }
}

async function countFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    let total = 0

    for (const entry of entries) {
      const absolutePath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await countFiles(absolutePath)
      } else if (entry.isFile()) {
        total += 1
      }
    }

    return total
  } catch {
    return 0
  }
}

async function buildSnapshot() {
  const databaseUrl = process.env.DATABASE_URL || null
  const mainDbPath = resolveSqlitePath(databaseUrl)
  const [mainDbSummary, authCounts, providerCounts, inventorySummary, vaults] = await Promise.all([
    mainDbPath ? getFileSummary(mainDbPath) : Promise.resolve(null),
    Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.session.count(),
      prisma.userPreference.count(),
      prisma.brokerageConnection.count(),
      prisma.brokerageAccount.count(),
    ]),
    Promise.all([
      prisma.providerCredential.count(),
      prisma.providerPoolMember.count(),
    ]),
    Promise.all([
      prisma.dataInventory.count(),
      prisma.dataInventory.groupBy({ by: ["symbol"] }),
      prisma.dataInventory.groupBy({ by: ["timeframe"] }),
      prisma.dataInventory.aggregate({ _max: { lastSynced: true } }),
    ]),
    prisma.vault.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        dbPath: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    }),
  ])

  const [
    userCount,
    accountCount,
    sessionCount,
    userPreferenceCount,
    brokerageConnectionCount,
    brokerageAccountCount,
  ] = authCounts
  const [providerCredentialCount, providerPoolMemberCount] = providerCounts
  const [inventoryCount, inventorySymbolGroups, inventoryTimeframes, inventoryAggregate] = inventorySummary

  const vaultSummaries = await Promise.all(
    vaults.map(async (vault) => {
      const resolvedPath = path.isAbsolute(vault.dbPath)
        ? vault.dbPath
        : path.join(rootDir, vault.dbPath)

      return {
        id: vault.id,
        name: vault.name,
        type: vault.type,
        createdAt: vault.createdAt.toISOString(),
        file: await getFileSummary(resolvedPath),
      }
    })
  )

  const telemetryPath = path.join(rootDir, "logs", "provider-traffic.jsonl")
  const lakePath = path.join(rootDir, "data", "lake")

  return {
    generatedAt: new Date().toISOString(),
    appDatabase: {
      databaseUrl,
      file: mainDbSummary,
    },
    authState: {
      userCount,
      accountCount,
      sessionCount,
      userPreferenceCount,
      brokerageConnectionCount,
      brokerageAccountCount,
    },
    providerState: {
      providerCredentialCount,
      providerPoolMemberCount,
    },
    inventoryState: {
      inventoryCount,
      symbolCount: inventorySymbolGroups.length,
      timeframeCount: inventoryTimeframes.length,
      latestSyncAt: inventoryAggregate._max.lastSynced?.toISOString() ?? null,
    },
    storage: {
      canonicalBarSource: "vault-sqlite",
      vaults: vaultSummaries,
      parquet: {
        root: lakePath,
        fileCount: await countFiles(lakePath),
      },
      telemetry: await getFileSummary(telemetryPath),
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const snapshot = await buildSnapshot()
  const payload = JSON.stringify(snapshot, null, 2)

  if (args.output) {
    const outputPath = path.isAbsolute(args.output)
      ? args.output
      : path.join(rootDir, args.output)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, payload)
  } else {
    process.stdout.write(`${payload}\n`)
  }
}

main()
  .catch((error) => {
    console.error("[platform-data-snapshot] Failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
