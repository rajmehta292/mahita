import fs from 'fs/promises'
import path from 'path'

const ROOT = process.cwd()
const DOCS_ROOT = path.join(ROOT, 'docs')
const GENERATED_ROOT = path.join(DOCS_ROOT, 'internal', 'generated')

export const CANONICAL_DOCS = [
  'docs/internal/guidebook/mahacharts/README.md',
  'docs/internal/guidebook/mahacharts/01-overview.md',
  'docs/internal/guidebook/mahacharts/02-ui-map.md',
  'docs/internal/guidebook/mahacharts/03-state-model.md',
  'docs/internal/guidebook/mahacharts/04-strategy-lifecycle.md',
  'docs/internal/guidebook/mahacharts/05-verification-matrix.md',
  'docs/internal/guidebook/mahacharts/06-change-rules.md',
]

export const REFERENCE_ARTIFACTS = [
  'docs/internal/evidence/archive/tradingview-research',
  'fixtures/tradingview',
]

export const SOURCE_PATHS = {
  components: [
    'app/components/SuperChart/SuperChartWorkspace.tsx',
    'app/components/Chart.tsx',
    'app/components/Backtest/MahitaCodeEditor.tsx',
  ],
  libraries: [
    'lib/indicator-catalog.ts',
    'lib/strategy-library.ts',
    'lib/strategy-deployments.ts',
    'lib/script-drafts.ts',
    'lib/user-preferences.ts',
    'lib/docs.ts',
  ],
  apiRoutes: [
    'app/api/indicators/catalog/route.ts',
    'app/api/strategies/route.ts',
    'app/api/strategies/[id]/route.ts',
    'app/api/strategies/[id]/versions/route.ts',
    'app/api/strategies/[id]/versions/[versionId]/route.ts',
    'app/api/strategies/[id]/versions/[versionId]/restore/route.ts',
    'app/api/strategies/[id]/workspace/route.ts',
    'app/api/trading/deployments/route.ts',
    'app/api/trading/deployments/[id]/route.ts',
    'app/api/trading/market-data/route.ts',
    'app/api/tradingview/webhook/[secret]/route.ts',
    'app/api/schwab/orders/route.ts',
  ],
  tests: [
    'tests/mahacharts-workspace.dom.test.tsx',
    'tests/strategies.route.test.ts',
    'tests/indicators-catalog.route.test.ts',
    'tests/trading-deployments.route.test.ts',
    'tests/trading-market-data.route.test.ts',
    'tests/tradingview-webhook.route.test.ts',
    'e2e/mahacharts.spec.ts',
    'e2e/mahacharts.multiuser.spec.ts',
  ],
}

export const CRITICAL_TEST_IDS = [
  'mahacharts-workspace',
  'mahacharts-topbar',
  'mahacharts-open-indicators',
  'mahacharts-open-strategies',
  'mahacharts-left-rail',
  'mahacharts-stage',
  'mahacharts-chart-shell',
  'mahacharts-chart-main',
  'mahacharts-right-strip',
  'mahacharts-right-icon-watchlist',
  'mahacharts-right-icon-details',
  'mahacharts-right-icon-trade',
  'mahacharts-right-icon-automation',
  'mahacharts-right-overlay',
  'mahacharts-right-overlay-close',
  'mahacharts-right-overlay-resize-handle',
  'mahacharts-dock',
  'mahacharts-editor-overlay',
  'mahacharts-editor-panel',
  'mahacharts-editor-resize-handle',
  'mahacharts-tester-panel',
  'mahacharts-logs-panel',
  'mahacharts-indicators-modal',
  'mahacharts-deployment-form',
]

function toAbsolute(relativePath) {
  return path.join(ROOT, relativePath)
}

async function readFile(relativeOrAbsolutePath) {
  return fs.readFile(toAbsolute(relativeOrAbsolutePath), 'utf8')
}

async function fileExists(relativeOrAbsolutePath) {
  try {
    await fs.access(toAbsolute(relativeOrAbsolutePath))
    return true
  } catch {
    return false
  }
}

function extractFrontmatterTitle(content, fallbackPath) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/^title:\s*(.+)$/m)
    if (titleMatch) {
      return titleMatch[1].replace(/^['"]|['"]$/g, '').trim()
    }
  }

  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) {
    return headingMatch[1].trim()
  }

  return path.basename(fallbackPath)
}

function extractTestIds(content) {
  return Array.from(content.matchAll(/data-testid="([^"]+)"/g), (match) => match[1]).sort()
}

function buildHandoffMarkdown({ generatedAt, canonicalDocs, uiMap, verification }) {
  return [
    '---',
    'title: MahaCharts Generated Handoff',
    'slug: generated/mahacharts-handoff',
    'category: guidebook',
    'visibility: signed-in',
    'audience: developers',
    'status: Current',
    `updatedAt: ${generatedAt.slice(0, 10)}`,
    '---',
    '',
    '# MahaCharts generated handoff',
    '',
    'This file is generated. Edit the canonical MahaCharts guidebook docs instead.',
    '',
    '## Core route',
    '',
    '- `/superchart`',
    '',
    '## Primary code surfaces',
    '',
    ...SOURCE_PATHS.components.map((file) => `- \`${file}\``),
    ...SOURCE_PATHS.libraries.map((file) => `- \`${file}\``),
    '',
    '## Canonical docs',
    '',
    ...canonicalDocs.map((doc) => `- ${doc.title}: \`${doc.path}\``),
    '',
    '## Required UI regions',
    '',
    ...uiMap.majorRegions.map((region) => `- \`${region.id}\`: ${region.description}`),
    '',
    '## Required verification',
    '',
    ...verification.deterministic.map((item) => `- ${item}`),
    ...verification.browser.map((item) => `- ${item}`),
    ...verification.manual.map((item) => `- ${item}`),
    '',
    '## Product rules',
    '',
    '- Keep the chart as the dominant desktop surface.',
    '- Keep deployments pinned to immutable strategy versions.',
    '- Keep docs and generated context updated with every meaningful MahaCharts change.',
    '',
  ].join('\n')
}

export async function buildMahaChartsArtifacts() {
  const generatedAt = new Date().toISOString().slice(0, 10)
  const workspaceSource = await readFile('app/components/SuperChart/SuperChartWorkspace.tsx')
  const chartSource = await readFile('app/components/Chart.tsx')
  const canonicalDocs = await Promise.all(
    CANONICAL_DOCS.map(async (docPath) => {
      const content = await readFile(docPath)
      return {
        title: extractFrontmatterTitle(content, docPath),
        path: docPath,
      }
    }),
  )

  const uiTestIds = extractTestIds(workspaceSource)
  const chartPaneTestIds = extractTestIds(chartSource)

  const context = {
    generatedAt,
    product: {
      label: 'MahaCharts',
      route: '/superchart',
      model: 'single-chart-first workspace',
    },
    canonicalDocs,
    references: await Promise.all(
      REFERENCE_ARTIFACTS.map(async (entry) => ({
        path: entry,
        exists: await fileExists(entry),
      })),
    ),
    code: {
      components: SOURCE_PATHS.components,
      libraries: SOURCE_PATHS.libraries,
      apiRoutes: SOURCE_PATHS.apiRoutes,
    },
    stateEntities: [
      'Strategy',
      'StrategyVersion',
      'StrategyWorkspaceSession',
      'StrategyDeployment',
      'UserPreference.indicatorFavorites',
    ],
    verificationScripts: [
      'npm run generate:mahacharts-context',
      'npm run verify:mahacharts-context',
      'npm run verify:mahacharts-doc-links',
      'npm run verify:mahacharts-coverage',
      'npm run test:mahacharts:deterministic',
      'npm run test:mahacharts:e2e',
      'npm run test:mahacharts:multiuser',
      'npm run test:mahacharts:visual',
      'npm run test:deployments',
      'npm run audit:mahacharts',
    ],
    criticalTests: SOURCE_PATHS.tests,
  }

  const uiMap = {
    generatedAt,
    route: '/superchart',
    majorRegions: [
      { id: 'mahacharts-topbar', description: 'Top command bar for symbol, timeframe, indicator, strategy, and save actions.' },
      { id: 'mahacharts-left-rail', description: 'Left drawing/tool rail.' },
      { id: 'mahacharts-stage', description: 'Center chart stage, chart shell, legend, and range controls.' },
      { id: 'mahacharts-dock', description: 'Bottom dock for editor, tester, orders, logs, and trading.' },
      { id: 'mahacharts-right-strip', description: 'Permanent right utility strip that keeps icon affordances visible while the chart remains dominant.' },
      { id: 'mahacharts-right-overlay', description: 'Shared right-side overlay spanning chart plus dock without reflowing the chart stage.' },
      { id: 'mahacharts-indicators-modal', description: 'Indicators, strategies, profiles, and patterns modal.' },
    ],
    dockTabs: ['editor', 'tester', 'trades', 'orders', 'positions', 'logs', 'trading'],
    railTabs: ['watchlist', 'details', 'trade', 'automation'],
    modalTabs: ['indicators', 'strategies', 'profiles', 'patterns'],
    workspaceTestIds: uiTestIds,
    chartPaneTestIds,
    requiredTestIds: CRITICAL_TEST_IDS,
    actionToRouteLinks: [
      { action: 'Open active trader', route: '/active-trader' },
      { action: 'Open backtester', route: '/backtest' },
      { action: 'Open script editor', route: '/script-editor' },
      { action: 'Open chart', route: '/chart' },
    ],
  }

  const verification = {
    generatedAt,
    deterministic: [
      'strategy route coverage',
      'indicator catalog route coverage',
      'deployment and webhook route coverage',
      'market-data route coverage',
      'workspace DOM coverage for modal, dock, and chart shell',
      'single-overlay controller coverage for editor and right-side overlays',
    ],
    browser: [
      'mahacharts shell smoke',
      'indicator modal flow',
      'right utility strip and overlay geometry',
      'chart visibility above the fold',
      'runtime-noise gate for update depth, nested buttons, and disposed chart objects',
      'desktop visual baselines',
      'concurrent-session propagation for strategies and deployments',
    ],
    manual: [
      'chart readability and pane density',
      'indicator add/remove ergonomics',
      'strategy version restore/delete flow',
      'dock and overlay resize balance',
      'long-session chart stability',
    ],
  }

  const handoff = buildHandoffMarkdown({
    generatedAt,
    canonicalDocs,
    uiMap,
    verification,
  })

  return {
    context,
    uiMap,
    verification,
    handoff,
  }
}

export async function writeMahaChartsArtifacts(artifacts) {
  await fs.mkdir(GENERATED_ROOT, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(GENERATED_ROOT, 'mahacharts-context.json'), `${JSON.stringify(artifacts.context, null, 2)}\n`),
    fs.writeFile(path.join(GENERATED_ROOT, 'mahacharts-ui-map.json'), `${JSON.stringify(artifacts.uiMap, null, 2)}\n`),
    fs.writeFile(path.join(GENERATED_ROOT, 'mahacharts-verification-checklist.json'), `${JSON.stringify(artifacts.verification, null, 2)}\n`),
    fs.writeFile(path.join(GENERATED_ROOT, 'mahacharts-handoff.md'), artifacts.handoff),
  ])
}

export async function readGeneratedArtifact(name) {
  return readFile(path.join('docs/internal/generated', name))
}

export async function generatedArtifactsExist() {
  const files = [
    'docs/internal/generated/mahacharts-context.json',
    'docs/internal/generated/mahacharts-ui-map.json',
    'docs/internal/generated/mahacharts-verification-checklist.json',
    'docs/internal/generated/mahacharts-handoff.md',
  ]

  const results = await Promise.all(files.map((file) => fileExists(file)))
  return results.every(Boolean)
}
