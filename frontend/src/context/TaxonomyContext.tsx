import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  fetchTaxonomy, TaxonomyData,
  DEFAULT_TAXONOMY, DEFAULT_REGIONS, DEFAULT_ORIGIN_CATEGORIES,
  DEFAULT_ALLIE_KNOCKOUT_STATES, DEFAULT_ANDRA_KNOCKOUT_STATES,
} from '../api'

// Bumped to v3 after a mid-session backend change split allie/andra knockout states — some v2
// caches were written moments before that backend deploy landed and are missing those fields.
const CACHE_KEY = 'htv_taxonomy_cache_v3'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h — schema rarely changes, refetched in the background beyond this

const FALLBACK: TaxonomyData = {
  industry: DEFAULT_TAXONOMY.industry,
  construction_stage: DEFAULT_TAXONOMY.construction_stage,
  product_type: DEFAULT_TAXONOMY.product_type,
  technology_type: DEFAULT_TAXONOMY.technology_type,
  region: DEFAULT_REGIONS,
  origin_category: DEFAULT_ORIGIN_CATEGORIES,
  allie_knockout_states: DEFAULT_ALLIE_KNOCKOUT_STATES,
  andra_knockout_states: DEFAULT_ANDRA_KNOCKOUT_STATES,
}

interface TaxonomyContextType {
  taxonomy: Record<string, string[]>
  regions: string[]
  originCategories: string[]
  allieKnockoutStates: string[]
  andraKnockoutStates: string[]
  loading: boolean
  refresh: () => void
}

const TaxonomyContext = createContext<TaxonomyContextType | undefined>(undefined)

const REQUIRED_KEYS: (keyof TaxonomyData)[] = [
  'industry', 'construction_stage', 'product_type', 'technology_type',
  'region', 'origin_category', 'allie_knockout_states', 'andra_knockout_states',
]

function isValidTaxonomyData(data: unknown): data is TaxonomyData {
  if (!data || typeof data !== 'object') return false
  return REQUIRED_KEYS.every(key => Array.isArray((data as Record<string, unknown>)[key]))
}

function readCache(): TaxonomyData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL_MS) return null
    // Guards against a cache written moments before a backend schema change lands —
    // a shape mismatch here should fall back to a fresh fetch, never crash a render.
    if (!isValidTaxonomyData(data)) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data: TaxonomyData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — fine to skip caching
  }
}

export function TaxonomyProvider({ children }: { children: ReactNode }) {
  const cached = readCache()
  const [data, setData] = useState<TaxonomyData>(cached ?? FALLBACK)
  const [loading, setLoading] = useState(!cached)

  async function load(force: boolean) {
    if (!force && readCache()) return // another tab/mount already warmed the cache
    setLoading(true)
    try {
      const fresh = await fetchTaxonomy()
      setData(fresh)
      writeCache(fresh)
    } catch (err) {
      console.error('Failed to fetch live taxonomy from Notion, using fallback', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!cached) load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: TaxonomyContextType = {
    taxonomy: {
      industry: data.industry,
      construction_stage: data.construction_stage,
      product_type: data.product_type,
      technology_type: data.technology_type,
      region: data.region,
    },
    regions: data.region,
    originCategories: data.origin_category,
    allieKnockoutStates: data.allie_knockout_states,
    andraKnockoutStates: data.andra_knockout_states,
    loading,
    refresh: () => load(true),
  }

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>
}

export function useTaxonomy() {
  const ctx = useContext(TaxonomyContext)
  if (ctx === undefined) {
    throw new Error('useTaxonomy must be used within a TaxonomyProvider')
  }
  return ctx
}
