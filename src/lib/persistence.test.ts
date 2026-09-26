import { beforeEach, describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  exportToJson,
  importFromJson,
  loadDecisions,
  saveDecisions,
} from './persistence'
import type { Decision } from './types'

function makeDecision(id: string, title = 'Test'): Decision {
  return {
    id,
    schemaVersion: 1,
    title,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    options: [],
    criteria: [],
    scores: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadDecisions / saveDecisions', () => {
  it('round-trips decisions through localStorage', () => {
    const decisions = [makeDecision('a'), makeDecision('b')]
    saveDecisions(decisions)
    expect(loadDecisions()).toEqual(decisions)
  })

  it('returns [] when nothing is stored yet', () => {
    expect(loadDecisions()).toEqual([])
  })

  it('returns [] (never throws) for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadDecisions()).toEqual([])
  })

  it('returns [] for a validly-parsed but wrong-shaped payload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }))
    expect(loadDecisions()).toEqual([])
  })

  it('filters out malformed entries inside an otherwise valid envelope', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        decisions: [makeDecision('a'), { garbage: true }],
      }),
    )
    expect(loadDecisions()).toEqual([makeDecision('a')])
  })
})

describe('export / import', () => {
  it('exports valid JSON that can be re-imported', () => {
    const decisions = [makeDecision('a'), makeDecision('b')]
    const json = exportToJson(decisions)
    const result = importFromJson(json, [])
    expect(result.decisions).toEqual(decisions)
    expect(result.errors).toEqual([])
  })

  it('skips duplicate ids on import and reports them', () => {
    const existing = [makeDecision('a', 'Existing A')]
    const json = exportToJson([makeDecision('a', 'Imported A'), makeDecision('b', 'Imported B')])
    const result = importFromJson(json, existing)
    expect(result.decisions.map((d) => d.id).sort()).toEqual(['a', 'b'])
    expect(result.decisions.find((d) => d.id === 'a')!.title).toBe('Existing A')
    expect(result.errors.length).toBe(1)
  })

  it('never throws on malformed import JSON, reports an error instead', () => {
    const result = importFromJson('not json at all', [])
    expect(result.decisions).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('reports per-record errors for malformed records but keeps valid ones', () => {
    const json = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      decisions: [makeDecision('a'), { not: 'a decision' }],
    })
    const result = importFromJson(json, [])
    expect(result.decisions).toEqual([makeDecision('a')])
    expect(result.errors.length).toBe(1)
  })
})
