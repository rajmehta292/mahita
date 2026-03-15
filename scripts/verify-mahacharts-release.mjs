import fs from 'fs/promises'
import path from 'path'

const ROOT = process.cwd()
const REPORT_PATH = path.join(ROOT, 'docs', 'internal', 'generated', 'mahacharts-audit-report.json')

let report
try {
  report = JSON.parse(await fs.readFile(REPORT_PATH, 'utf8'))
} catch {
  console.error('Missing MahaCharts audit report. Run `npm run audit:mahacharts` first.')
  process.exit(1)
}

const { summary } = report
if (!summary?.passed || (summary?.p0 ?? 0) > 0 || (summary?.p1 ?? 0) > 0 || (summary?.majorUiFindings ?? 0) > 0) {
  console.error('MahaCharts release verification failed. Resolve the audit findings before release.')
  process.exit(1)
}

console.log('MahaCharts release verification passed.')
