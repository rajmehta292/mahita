import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE_PATH = path.join(ROOT, 'docs', 'current_state_baseline.md')
const REPORT_PATH = path.join(ROOT, 'docs', 'internal', 'generated', 'repo-audit-report.json')
const START_MARKER = '<!-- REPO_AUDIT:START -->'
const END_MARKER = '<!-- REPO_AUDIT:END -->'

function renderSnapshot(report) {
  const laneLines = report.lanes.map((lane) => {
    if (lane.manual) {
      return `- ${lane.name}: manual`
    }

    return `- ${lane.name}: ${lane.passed ? 'pass' : 'fail'}`
  })

  return [
    START_MARKER,
    `Generated from \`docs/internal/generated/repo-audit-report.json\` on ${report.generatedAt}.`,
    '',
    ...laneLines,
    '',
    report.summary.failedLanes.length === 0
      ? '- blocking findings: none'
      : `- blocking findings: ${report.summary.failedLanes.join(', ')}`,
    END_MARKER,
  ].join('\n')
}

const [baseline, reportText] = await Promise.all([
  fs.readFile(BASELINE_PATH, 'utf8'),
  fs.readFile(REPORT_PATH, 'utf8'),
])

const report = JSON.parse(reportText)
const snapshot = renderSnapshot(report)

if (!baseline.includes(START_MARKER) || !baseline.includes(END_MARKER)) {
  throw new Error('docs/current_state_baseline.md is missing repo audit markers.')
}

const updated = baseline.replace(new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`), snapshot)
await fs.writeFile(BASELINE_PATH, updated)

console.log('Updated docs/current_state_baseline.md with the latest repo audit snapshot.')
