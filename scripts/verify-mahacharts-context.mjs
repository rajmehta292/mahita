import { buildMahaChartsArtifacts, generatedArtifactsExist, readGeneratedArtifact } from './lib/mahacharts-context.mjs'

if (!(await generatedArtifactsExist())) {
  console.error('Generated MahaCharts artifacts are missing. Run `npm run generate:mahacharts-context`.')
  process.exit(1)
}

const artifacts = await buildMahaChartsArtifacts()
const comparisons = [
  ['mahacharts-context.json', `${JSON.stringify(artifacts.context, null, 2)}\n`],
  ['mahacharts-ui-map.json', `${JSON.stringify(artifacts.uiMap, null, 2)}\n`],
  ['mahacharts-verification-checklist.json', `${JSON.stringify(artifacts.verification, null, 2)}\n`],
  ['mahacharts-handoff.md', artifacts.handoff],
]

for (const [fileName, expected] of comparisons) {
  const actual = await readGeneratedArtifact(fileName)
  if (actual !== expected) {
    console.error(`Generated MahaCharts artifact is stale: ${fileName}`)
    process.exit(1)
  }
}

console.log('MahaCharts context artifacts are up to date.')
