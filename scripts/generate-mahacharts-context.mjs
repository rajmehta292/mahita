import { buildMahaChartsArtifacts, writeMahaChartsArtifacts } from './lib/mahacharts-context.mjs'

const artifacts = await buildMahaChartsArtifacts()
await writeMahaChartsArtifacts(artifacts)

console.log('Generated MahaCharts context artifacts.')
