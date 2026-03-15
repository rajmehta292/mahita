import fs from 'fs/promises'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = process.cwd()
const GENERATED_DIR = path.join(ROOT, 'docs', 'internal', 'generated')
const REPORT_PATH = path.join(GENERATED_DIR, 'mahacharts-audit-report.json')
const SUMMARY_PATH = path.join(GENERATED_DIR, 'mahacharts-audit-summary.md')

const lanes = [
  { name: 'deterministic', command: ['npm', 'run', 'test:mahacharts:deterministic'] },
  { name: 'browser', command: ['npm', 'run', 'test:mahacharts:e2e'] },
  { name: 'multiuser', command: ['npm', 'run', 'test:mahacharts:multiuser'] },
  { name: 'visual', command: ['npm', 'run', 'test:mahacharts:visual'] },
  { name: 'context', command: ['npm', 'run', 'generate:mahacharts-context'] },
  { name: 'context-verify', command: ['npm', 'run', 'verify:mahacharts-context'] },
  { name: 'doc-links', command: ['npm', 'run', 'verify:mahacharts-doc-links'] },
  { name: 'coverage', command: ['npm', 'run', 'verify:mahacharts-coverage'] },
]

function runLane({ name, command }) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  return {
    name,
    command: command.join(' '),
    exitCode: result.status ?? 1,
    passed: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

await fs.mkdir(GENERATED_DIR, { recursive: true })

const startedAt = new Date().toISOString()
const results = lanes.map(runLane)
const failed = results.filter((result) => !result.passed)
const report = {
  generatedAt: startedAt,
  summary: {
    passed: failed.length === 0,
    totalLanes: results.length,
    failedLanes: failed.map((lane) => lane.name),
    p0: failed.length,
    p1: 0,
    majorUiFindings: failed.length,
  },
  lanes: results,
}

await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)

const summary = [
  '# MahaCharts audit summary',
  '',
  `Generated: ${startedAt}`,
  '',
  ...results.map((result) => `- ${result.passed ? 'PASS' : 'FAIL'} \`${result.name}\` via \`${result.command}\``),
  '',
  '## Blocking findings',
  ...(failed.length
    ? failed.flatMap((result) => [
        '',
        `### ${result.name}`,
        '',
        '```text',
        (result.stderr || result.stdout || 'Command failed without output.').trim(),
        '```',
      ])
    : ['','None.']),
].filter(Boolean).join('\n')

await fs.writeFile(SUMMARY_PATH, `${summary}\n`)

if (failed.length > 0) {
  console.error(`MahaCharts audit failed in ${failed.length} lane(s). See ${path.relative(ROOT, REPORT_PATH)}.`)
  process.exit(1)
}

console.log(`MahaCharts audit passed. Report written to ${path.relative(ROOT, REPORT_PATH)}.`)
