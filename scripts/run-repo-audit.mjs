import fs from 'node:fs/promises'
import path from 'node:path'
import { runCommand } from './lib/command-runner.mjs'

const ROOT = process.cwd()
const GENERATED_DIR = path.join(ROOT, 'docs', 'internal', 'generated')
const REPORT_PATH = path.join(GENERATED_DIR, 'repo-audit-report.json')
const SUMMARY_PATH = path.join(GENERATED_DIR, 'repo-audit-summary.md')

const lanes = [
  { name: 'typecheck', severity: 'P1', command: ['npm', 'run', 'verify:repo:typecheck'] },
  { name: 'lint-source', severity: 'P1', command: ['npm', 'run', 'verify:repo:lint:source'] },
  { name: 'lint-noise', severity: 'P2', command: ['npm', 'run', 'verify:repo:lint:noise'] },
  { name: 'repo-hygiene', severity: 'P1', command: ['npm', 'run', 'verify:repo:repo-hygiene'] },
  { name: 'docs-portability', severity: 'P1', command: ['npm', 'run', 'verify:repo:docs-portability'] },
  { name: 'unit', severity: 'P1', command: ['npm', 'run', 'verify:repo:unit'] },
  { name: 'e2e', severity: 'P1', command: ['npm', 'run', 'verify:repo:e2e'] },
  { name: 'visual', severity: 'P2', command: ['npm', 'run', 'verify:repo:visual'] },
  { name: 'build', severity: 'P1', command: ['npm', 'run', 'verify:repo:build'] },
  { name: 'live-smoke', severity: 'manual', manual: true, note: 'Manual runbook required on the Windows operator machine with secrets.' },
]

function runLane(lane) {
  if (lane.manual) {
    return {
      name: lane.name,
      severity: lane.severity,
      manual: true,
      passed: null,
      exitCode: null,
      stdout: '',
      stderr: '',
      note: lane.note,
    }
  }

  const result = runCommand(lane.command[0], lane.command.slice(1), {
    cwd: ROOT,
    stdio: 'pipe',
  })

  return {
    name: lane.name,
    severity: lane.severity,
    manual: false,
    ...result,
  }
}

await fs.mkdir(GENERATED_DIR, { recursive: true })

const generatedAt = new Date().toISOString()
const results = lanes.map(runLane)
const failed = results.filter((result) => result.passed === false)

const report = {
  generatedAt,
  summary: {
    passed: failed.length === 0,
    totalLanes: results.length,
    failedLanes: failed.map((lane) => lane.name),
    severityCounts: failed.reduce((counts, lane) => {
      counts[lane.severity] = (counts[lane.severity] ?? 0) + 1
      return counts
    }, {}),
  },
  lanes: results,
}

await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)

const summary = [
  '# Repo audit summary',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Lane status',
  ...results.map((result) => {
    if (result.manual) {
      return `- MANUAL \`${result.name}\` - ${result.note}`
    }

    return `- ${result.passed ? 'PASS' : 'FAIL'} \`${result.name}\` via \`${result.command}\``
  }),
  '',
  '## Blocking findings',
  ...(failed.length === 0
    ? ['- None.']
    : failed.flatMap((result) => [
        `- ${result.severity} \`${result.name}\``,
        '',
        '```text',
        (result.stderr || result.stdout || 'Command failed without output.').trim(),
        '```',
        '',
      ])),
].join('\n')

await fs.writeFile(SUMMARY_PATH, `${summary}\n`)

const baselineUpdate = runCommand('node', ['./scripts/update-current-state-baseline.mjs'], {
  cwd: ROOT,
  stdio: 'pipe',
})

if (!baselineUpdate.passed) {
  console.error(baselineUpdate.stderr || baselineUpdate.stdout)
  process.exit(1)
}

if (failed.length > 0) {
  console.error(`Repo audit failed in ${failed.length} lane(s). See ${path.relative(ROOT, REPORT_PATH)}.`)
  process.exit(1)
}

console.log(`Repo audit passed. Report written to ${path.relative(ROOT, REPORT_PATH)}.`)
