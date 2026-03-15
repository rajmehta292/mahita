import fs from 'fs/promises'
import path from 'path'
import { CRITICAL_TEST_IDS, SOURCE_PATHS } from './lib/mahacharts-context.mjs'

const ROOT = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8')
}

const workspaceSource = await read('app/components/SuperChart/SuperChartWorkspace.tsx')
const chartSource = await read('app/components/Chart.tsx')
const domTestSource = await read('tests/mahacharts-workspace.dom.test.tsx')
const e2eSource = await read('e2e/mahacharts.spec.ts')

const combinedUiSource = `${workspaceSource}\n${chartSource}`
const missingTestIds = CRITICAL_TEST_IDS.filter((testId) => !combinedUiSource.includes(testId))
if (missingTestIds.length > 0) {
  console.error(`Missing critical MahaCharts test ids in workspace source: ${missingTestIds.join(', ')}`)
  process.exit(1)
}

const domCoverageNeedles = [
  'mahacharts-topbar',
  'mahacharts-dock',
  'mahacharts-open-indicators',
  'mahacharts-indicators-modal',
  'mahacharts-right-strip',
  'mahacharts-right-overlay',
]
const missingDomCoverage = domCoverageNeedles.filter((needle) => !domTestSource.includes(needle))
if (missingDomCoverage.length > 0) {
  console.error(`DOM coverage is missing MahaCharts assertions for: ${missingDomCoverage.join(', ')}`)
  process.exit(1)
}

const e2eCoverageNeedles = [
  'mahacharts-chart-main',
  'mahacharts-topbar',
  'mahacharts-right-strip',
  'mahacharts-right-overlay',
  'mahacharts-dock',
]
const missingE2eCoverage = e2eCoverageNeedles.filter((needle) => !e2eSource.includes(needle))
if (missingE2eCoverage.length > 0) {
  console.error(`Playwright coverage is missing MahaCharts assertions for: ${missingE2eCoverage.join(', ')}`)
  process.exit(1)
}

const requiredTestFiles = SOURCE_PATHS.tests
for (const relativePath of requiredTestFiles) {
  try {
    await fs.access(path.join(ROOT, relativePath))
  } catch {
    console.error(`Required MahaCharts test file is missing: ${relativePath}`)
    process.exit(1)
  }
}

console.log('MahaCharts coverage contracts are present.')
