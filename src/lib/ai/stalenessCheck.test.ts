import { describe, expect, it } from 'vitest'
import { hashDecisionContent, isChallengeStale } from './stalenessCheck'
import type { Decision } from '../types'

function decision(partial: Partial<Decision>): Decision {
  return {
    id: 'd1',
    schemaVersion: 1,
    title: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    options: [],
    criteria: [],
    scores: [],
    ...partial,
  }
}

describe('hashDecisionContent / isChallengeStale', () => {
  it('is stable across calls for identical content', () => {
    const d = decision({ title: 'A' })
    expect(hashDecisionContent(d)).toBe(hashDecisionContent(d))
  })

  it('stays the same when only updatedAt/createdAt change', () => {
    const d1 = decision({ title: 'A', updatedAt: '2026-01-01T00:00:00.000Z' })
    const d2 = decision({ title: 'A', updatedAt: '2026-06-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' })
    expect(hashDecisionContent(d1)).toBe(hashDecisionContent(d2))
    expect(isChallengeStale(d2, hashDecisionContent(d1))).toBe(false)
  })

  it('changes when a score value changes', () => {
    const d1 = decision({
      options: [{ id: 'a', name: 'A' }],
      criteria: [{ id: 'c1', name: 'C', weight: 100 }],
      scores: [{ optionId: 'a', criterionId: 'c1', value: 5, reasoning: 'r' }],
    })
    const d2 = { ...d1, scores: [{ optionId: 'a', criterionId: 'c1', value: 9, reasoning: 'r' }] }
    expect(hashDecisionContent(d1)).not.toBe(hashDecisionContent(d2))
    expect(isChallengeStale(d2, hashDecisionContent(d1))).toBe(true)
  })

  it('changes when reasoning text changes', () => {
    const d1 = decision({
      options: [{ id: 'a', name: 'A' }],
      criteria: [{ id: 'c1', name: 'C', weight: 100 }],
      scores: [{ optionId: 'a', criterionId: 'c1', value: 5, reasoning: 'old reasoning' }],
    })
    const d2 = { ...d1, scores: [{ optionId: 'a', criterionId: 'c1', value: 5, reasoning: 'new reasoning' }] }
    expect(isChallengeStale(d2, hashDecisionContent(d1))).toBe(true)
  })

  it('is insensitive to array order (sorted internally)', () => {
    const d1 = decision({
      options: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    })
    const d2 = decision({
      options: [
        { id: 'b', name: 'B' },
        { id: 'a', name: 'A' },
      ],
    })
    expect(hashDecisionContent(d1)).toBe(hashDecisionContent(d2))
  })
})
