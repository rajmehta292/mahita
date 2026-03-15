import { runBuiltInParityBatch } from '@/lib/parity-fixtures'

function parseFixtureKeys(argv: string[]) {
    const keyArgs = argv
        .filter((value) => value.startsWith('--fixture='))
        .map((value) => value.slice('--fixture='.length))
        .filter(Boolean)

    return keyArgs.length > 0 ? keyArgs : undefined
}

async function main() {
    const fixtureKeys = parseFixtureKeys(process.argv.slice(2))
    const report = await runBuiltInParityBatch(fixtureKeys)

    console.log(JSON.stringify(report, null, 2))
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
