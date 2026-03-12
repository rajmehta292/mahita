#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="$ROOT_DIR/artifacts/senior-project"
mkdir -p "$OUTPUT_DIR"

STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'unknown')"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

cat > "$OUTPUT_DIR/00-summary.md" <<EOF
# Mahita Senior Project Evidence Export

- Generated: $STAMP
- Branch: $BRANCH
- Commit: $COMMIT

This folder captures a reproducible evidence snapshot for the Mahita senior project presentation. It is intentionally honest about the project's transitional state.
EOF

git status --short > "$OUTPUT_DIR/01-git-status.txt" || true
git log --date=short --pretty=format:'- %ad %h %s' -n 120 > "$OUTPUT_DIR/02-git-milestones.md" || true
git log --stat --date=short -n 40 > "$OUTPUT_DIR/03-git-log-with-stats.txt" || true

cp docs/current_state_baseline.md "$OUTPUT_DIR/10-current-state-baseline.md"
cp docs/public/senior-project/report-draft.md "$OUTPUT_DIR/11-report-draft.md"
cp docs/public/senior-project/presentation-outline.md "$OUTPUT_DIR/12-presentation-outline.md"
cp docs/public/senior-project/bug-limitations-appendix.md "$OUTPUT_DIR/13-known-limitations.md"
cp docs/internal/evidence/development-timeline.md "$OUTPUT_DIR/14-development-timeline.md"
cp docs/internal/evidence/architecture-decisions.md "$OUTPUT_DIR/15-architecture-decisions.md"
cp docs/internal/evidence/test-evidence-index.md "$OUTPUT_DIR/16-test-evidence-index.md"
cp docs/internal/runbooks/presentation-day-recovery.md "$OUTPUT_DIR/17-presentation-day-recovery.md"
cp docs/public/senior-project/presentation-speaking-notes.md "$OUTPUT_DIR/18-presentation-speaking-notes.md"
cp docs/public/senior-project/presentation-qa-prep.md "$OUTPUT_DIR/19-presentation-qa-prep.md"
cp docs/public/senior-project/presentation-visual-asset-list.md "$OUTPUT_DIR/20-presentation-visual-asset-list.md"
cp docs/public/senior-project/report-appendix-evidence.md "$OUTPUT_DIR/21-report-appendix-evidence.md"
cp docs/public/senior-project/report-appendix-limitations.md "$OUTPUT_DIR/22-report-appendix-limitations.md"
cp docs/public/senior-project/report-appendix-future-work.md "$OUTPUT_DIR/23-report-appendix-future-work.md"
cp docs/public/senior-project/report-appendix-architecture.md "$OUTPUT_DIR/24-report-appendix-architecture.md"
cp docs/public/project-overview/how-to-use-this-documentation.md "$OUTPUT_DIR/25-how-to-use-this-documentation.md"
cp docs/public/project-overview/getting-started-fast.md "$OUTPUT_DIR/26-getting-started-fast.md"
cp docs/public/project-overview/presentation-for-reviewers.md "$OUTPUT_DIR/27-presentation-for-reviewers.md"
cp docs/public/senior-project/demo-modes.md "$OUTPUT_DIR/28-demo-modes.md"
cp docs/internal/guidebook/post-presentation-recovery-plan.md "$OUTPUT_DIR/29-post-presentation-recovery-plan.md"
cp docs/internal/runbooks/operator-cheatsheet.md "$OUTPUT_DIR/30-operator-cheatsheet.md"

echo "Evidence exported to $OUTPUT_DIR"
