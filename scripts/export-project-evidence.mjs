import fs from 'node:fs/promises'
import path from 'node:path'
import { runCommand } from './lib/command-runner.mjs'

const ROOT = process.cwd()
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 'senior-project')

const COPY_TARGETS = [
  ['docs/current_state_baseline.md', '10-current-state-baseline.md'],
  ['docs/public/senior-project/report-draft.md', '11-report-draft.md'],
  ['docs/public/senior-project/presentation-outline.md', '12-presentation-outline.md'],
  ['docs/public/senior-project/bug-limitations-appendix.md', '13-known-limitations.md'],
  ['docs/internal/evidence/development-timeline.md', '14-development-timeline.md'],
  ['docs/internal/evidence/architecture-decisions.md', '15-architecture-decisions.md'],
  ['docs/internal/evidence/test-evidence-index.md', '16-test-evidence-index.md'],
  ['docs/internal/runbooks/presentation-day-recovery.md', '17-presentation-day-recovery.md'],
  ['docs/public/senior-project/presentation-speaking-notes.md', '18-presentation-speaking-notes.md'],
  ['docs/public/senior-project/presentation-qa-prep.md', '19-presentation-qa-prep.md'],
  ['docs/public/senior-project/presentation-visual-asset-list.md', '20-presentation-visual-asset-list.md'],
  ['docs/public/senior-project/report-appendix-evidence.md', '21-report-appendix-evidence.md'],
  ['docs/public/senior-project/report-appendix-limitations.md', '22-report-appendix-limitations.md'],
  ['docs/public/senior-project/report-appendix-future-work.md', '23-report-appendix-future-work.md'],
  ['docs/public/senior-project/report-appendix-architecture.md', '24-report-appendix-architecture.md'],
  ['docs/public/project-overview/how-to-use-this-documentation.md', '25-how-to-use-this-documentation.md'],
  ['docs/public/project-overview/getting-started-fast.md', '26-getting-started-fast.md'],
  ['docs/public/project-overview/presentation-for-reviewers.md', '27-presentation-for-reviewers.md'],
  ['docs/public/senior-project/demo-modes.md', '28-demo-modes.md'],
  ['docs/internal/guidebook/post-presentation-recovery-plan.md', '29-post-presentation-recovery-plan.md'],
  ['docs/internal/runbooks/operator-cheatsheet.md', '30-operator-cheatsheet.md'],
  ['docs/internal/guidebook/platform-data-architecture-audit.md', '31-platform-data-architecture-audit.md'],
  ['docs/internal/runbooks/platform-data-backup-and-restore.md', '32-platform-data-backup-and-restore.md'],
  ['docs/internal/runbooks/platform-data-migrations.md', '33-platform-data-migrations.md'],
  ['docs/internal/evidence/build-log-2026-03-11-platform-data.md', '34-build-log-2026-03-11-platform-data.md'],
  ['docs/public/project-overview/platform-data-summary.md', '35-platform-data-summary.md'],
]

function commandOutput(command, args) {
  const result = runCommand(command, args, { cwd: ROOT, stdio: 'pipe' })
  return (result.stdout || result.stderr || 'unavailable').trim()
}

await fs.mkdir(OUTPUT_DIR, { recursive: true })

const generatedAt = new Date().toISOString()
const branch = commandOutput('git', ['branch', '--show-current'])
const commit = commandOutput('git', ['rev-parse', '--short', 'HEAD'])
const status = commandOutput('git', ['status', '--short'])
const milestones = commandOutput('git', ['log', '--date=short', '--pretty=format:- %ad %h %s', '-n', '120'])
const logWithStats = commandOutput('git', ['log', '--stat', '--date=short', '-n', '40'])

await fs.writeFile(path.join(OUTPUT_DIR, '00-summary.md'), [
  '# Mahita Senior Project Evidence Export',
  '',
  `- Generated: ${generatedAt}`,
  `- Branch: ${branch || 'unknown'}`,
  `- Commit: ${commit || 'unknown'}`,
  '',
  'This folder captures a reproducible evidence snapshot for the Mahita senior project presentation.',
].join('\n'))

await fs.writeFile(path.join(OUTPUT_DIR, '01-git-status.txt'), `${status}\n`)
await fs.writeFile(path.join(OUTPUT_DIR, '02-git-milestones.md'), `${milestones}\n`)
await fs.writeFile(path.join(OUTPUT_DIR, '03-git-log-with-stats.txt'), `${logWithStats}\n`)

for (const [source, destination] of COPY_TARGETS) {
  await fs.copyFile(path.join(ROOT, source), path.join(OUTPUT_DIR, destination))
}

console.log(`Evidence exported to ${OUTPUT_DIR}`)
