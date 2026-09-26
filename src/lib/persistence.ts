// localStorage persistence with a versioned envelope and a documented
// migration seam. Never throws -- callers can always trust a Decision[] back.

import type { Decision } from './types'

export const STORAGE_KEY = 'splitsecond.decisions.v1'
export const CURRENT_SCHEMA_VERSION = 1 as const

interface StorageEnvelope {
  schemaVersion: number
  decisions: Decision[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function looksLikeDecision(value: unknown): value is Decision {
  if (!isPlainObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.options) &&
    Array.isArray(value.criteria) &&
    Array.isArray(value.scores)
  )
}

/** No-op for schemaVersion 1. Documented seam for future migrations. */
export function migrate(envelope: StorageEnvelope): StorageEnvelope {
  if (envelope.schemaVersion === CURRENT_SCHEMA_VERSION) return envelope
  // Future versions: transform envelope.decisions here based on
  // envelope.schemaVersion, then bump schemaVersion to CURRENT_SCHEMA_VERSION.
  return { schemaVersion: CURRENT_SCHEMA_VERSION, decisions: envelope.decisions }
}

export function loadDecisions(): Decision[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed) || !Array.isArray(parsed.decisions)) return []
    const migrated = migrate({
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
      decisions: parsed.decisions.filter(looksLikeDecision),
    })
    return migrated.decisions
  } catch {
    return []
  }
}

export function saveDecisions(decisions: Decision[]): void {
  const envelope: StorageEnvelope = { schemaVersion: CURRENT_SCHEMA_VERSION, decisions }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
}

export function exportToJson(decisions: Decision[]): string {
  const envelope: StorageEnvelope = { schemaVersion: CURRENT_SCHEMA_VERSION, decisions }
  return JSON.stringify(envelope, null, 2)
}

export interface ImportResult {
  decisions: Decision[]
  errors: string[]
}

/**
 * Merges imported decisions into the existing set: skips any imported
 * decision whose id already exists, adds the rest. Never throws on
 * malformed input -- reports per-record errors instead.
 */
export function importFromJson(json: string, existing: Decision[] = []): ImportResult {
  const errors: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { decisions: existing, errors: ['Could not parse file as JSON.'] }
  }

  let candidateDecisions: unknown[] = []
  if (isPlainObject(parsed) && Array.isArray(parsed.decisions)) {
    candidateDecisions = parsed.decisions
  } else if (Array.isArray(parsed)) {
    candidateDecisions = parsed
  } else {
    return { decisions: existing, errors: ['File does not contain a decisions array.'] }
  }

  const existingIds = new Set(existing.map((d) => d.id))
  const merged = [...existing]

  candidateDecisions.forEach((candidate, index) => {
    if (!looksLikeDecision(candidate)) {
      errors.push(`Record at index ${index} is not a valid decision and was skipped.`)
      return
    }
    if (existingIds.has(candidate.id)) {
      errors.push(`Decision "${candidate.title}" (${candidate.id}) already exists and was skipped.`)
      return
    }
    existingIds.add(candidate.id)
    merged.push(candidate)
  })

  return { decisions: merged, errors }
}
