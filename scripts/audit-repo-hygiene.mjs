import fs from 'node:fs/promises'
import path from 'node:path'
import { runChecked } from './lib/command-runner.mjs'

const ROOT = process.cwd()
const GENERATED_DIR = path.join(ROOT, 'docs', 'internal', 'generated')
const REPORT_PATH = path.join(GENERATED_DIR, 'repo-hygiene-report.json')
const SUMMARY_PATH = path.join(GENERATED_DIR, 'repo-hygiene-summary.md')
const verifyMode = process.argv.includes('--verify')

function listTrackedFiles() {
  const result = runChecked('git', ['ls-files', '-z'])
  return result.stdout
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const rules = [
  {
    id: 'tracked-ds-store',
    severity: 'P1',
    matches: (file) => file.endsWith('.DS_Store'),
    message: 'Do not track macOS Finder metadata.',
  },
  {
    id: 'tracked-temp-files',
    severity: 'P1',
    matches: (file) => file.startsWith('tmp/'),
    message: 'Scratch files under tmp/ should not be tracked.',
  },
  {
    id: 'tracked-node-modules',
    severity: 'P1',
    matches: (file) => file.startsWith('node_modules/'),
    message: 'Dependency installs must not be tracked.',
  },
  {
    id: 'tracked-root-zip',
    severity: 'P1',
    matches: (file) => file === '.!97539!tradingview_insp.zip',
    message: 'Root zip captures are repo waste and should not be tracked.',
  },
  {
    id: 'tracked-archive-zip',
    severity: 'P2',
    matches: (file) => file === 'docs/internal/evidence/archive/tradingview-research/tradingview_insp.zip',
    message: 'Raw vendor archive zips should be summarized, not tracked.',
  },
  {
    id: 'tracked-archive-captures',
    severity: 'P1',
    matches: (file) => file.startsWith('docs/internal/evidence/archive/tradingview-research/tradingview_extracted/'),
    message: 'Extracted vendor captures should not live in the tracked repo tree.',
  },
  {
    id: 'tracked-artifacts',
    severity: 'P2',
    matches: (file) => file.startsWith('artifacts/'),
    message: 'Generated artifacts should not be tracked in the main repo tree.',
  },
]

const trackedFiles = listTrackedFiles()
const findings = trackedFiles.flatMap((file) => {
  return rules
    .filter((rule) => rule.matches(file))
    .map((rule) => ({
      file,
      rule: rule.id,
      severity: rule.severity,
      message: rule.message,
    }))
})

const severityCounts = findings.reduce((counts, finding) => {
  counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
  return counts
}, {})

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    trackedFiles: trackedFiles.length,
    findings: findings.length,
    severityCounts,
    passed: findings.length === 0,
  },
  findings,
}

await fs.mkdir(GENERATED_DIR, { recursive: true })
await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)

const summary = [
  '# Repo hygiene summary',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `- Tracked files scanned: ${trackedFiles.length}`,
  `- Findings: ${findings.length}`,
  '',
  '## Findings',
  findings.length === 0
    ? ''
    : findings.map((finding) => `- ${finding.severity} \`${finding.file}\` - ${finding.message}`).join('\n'),
  findings.length === 0 ? 'None.' : '',
].filter(Boolean).join('\n')

await fs.writeFile(SUMMARY_PATH, `${summary}\n`)

if (verifyMode && findings.length > 0) {
  console.error(`Repo hygiene audit found ${findings.length} issue(s). See ${path.relative(ROOT, REPORT_PATH)}.`)
  process.exit(1)
}

console.log(`Repo hygiene audit ${findings.length === 0 ? 'passed' : 'completed with findings'}.`)
