export type ScreenerFieldGroup =
  | "descriptive"
  | "fundamental"
  | "technical"
  | "news"
  | "etf"
  | "all"

export type ScreenerAssetScope = "equity" | "etf" | "all"
export type ScreenerValueType = "number" | "string" | "boolean" | "enum"
export type ScreenerOrderDirection = "asc" | "desc"

export interface ScreenerFieldOption {
  value: string
  label: string
}

export interface ScreenerFieldDefinition {
  key: string
  label: string
  group: Exclude<ScreenerFieldGroup, "all">
  valueType: ScreenerValueType
  assetScope: ScreenerAssetScope
  description?: string
  options: ScreenerFieldOption[]
}

export interface ScreenerFilterClause {
  field: string
  value: string
}

export interface ScreenerQueryRequest {
  groupTab: ScreenerFieldGroup
  resultTab: string
  orderKey: string
  orderDirection: ScreenerOrderDirection
  signal: string
  tickerQuery?: string
  filters: ScreenerFilterClause[]
  page: number
  pageSize: number
}

export interface ScreenerResultColumn {
  key: string
  label: string
  align?: "left" | "right" | "center"
  format?: "text" | "price" | "percent" | "number" | "volume" | "marketCap"
}

export interface ScreenerResultTabDefinition {
  key: string
  label: string
  columns: ScreenerResultColumn[]
}

export interface ScreenerPresetDocument {
  id?: string
  name: string
  groupTab: ScreenerFieldGroup
  resultTab: string
  orderKey: string
  orderDirection: ScreenerOrderDirection
  signal: string
  filters: ScreenerFilterClause[]
  builtIn?: boolean
}

export interface ScreenerRow {
  symbol: string
  name: string
  assetType: string
  exchange: string | null
  sector: string | null
  industry: string | null
  country: string | null
  isEtf: boolean
  sponsor: string | null
  price: number | null
  changePercent: number | null
  volume: number | null
  marketCap: number | null
  updatedAt: string | null
  descriptive: Record<string, unknown>
  fundamental: Record<string, unknown>
  technical: Record<string, unknown>
  news: Record<string, unknown>
  etf: Record<string, unknown>
}

export interface ScreenerQueryResponse {
  rows: ScreenerRow[]
  totalCount: number
  page: number
  pageSize: number
  freshness: {
    asOf: string | null
    source: string
    universeSize: number
  }
}

export interface GlobalSearchResult {
  id: string
  group: "instruments" | "presets" | "strategies" | "watchlist" | "portfolio" | "documentation"
  title: string
  subtitle?: string
  href: string
  symbol?: string
  score: number
  badge?: string
}

export interface GlobalSearchGroup {
  key: GlobalSearchResult["group"]
  label: string
  results: GlobalSearchResult[]
}

export interface ScreenerMetricPayload {
  descriptive: Record<string, unknown>
  fundamental: Record<string, unknown>
  technical: Record<string, unknown>
  news: Record<string, unknown>
  etf: Record<string, unknown>
}
