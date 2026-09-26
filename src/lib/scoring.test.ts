import { describe, expect, it } from 'vitest'
import { computeDecisionResult, computeOptionBreakdown } from './scoring'
import type { Criterion, Decision, Option, Score } from './types'

function opt(id: string): Option {
  return { id, name: id }
}
function crit(id: string, weight: number): Criterion {
  return { id, name: id, weight }
}
function score(optionId: string, criterionId: string, value: number | null, reasoning = 'r'): Score {
  return { optionId, criterionId, value, reasoning }
}

function decision(partial: Partial<Decision>): Decision {
  return {
    id: 'd1',
    schemaVersion: 1,
    title: 'Test decision',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    options: [],
    criteria: [],
    scores: [],
    ...partial,
  }
}

describe('computeOptionBreakdown', () => {
  it('computes a weighted sum across multiple criteria', () => {
    const criteria = [crit('cost', 60), crit('quality', 40)]
    const scores = [score('a', 'cost', 8), score('a', 'quality', 5)]
    const breakdown = computeOptionBreakdown(opt('a'), criteria, scores)
    // 0.6*8 + 0.4*5 = 4.8 + 2 = 6.8
    expect(breakdown.weightedTotal).toBeCloseTo(6.8)
    expect(breakdown.missingCells).toBe(0)
  })

  it('excludes missing cells from the sum without renormalizing remaining weights', () => {
    const criteria = [crit('cost', 60), crit('quality', 40)]
    const scores = [score('a', 'cost', 10)] // quality unscored
    const breakdown = computeOptionBreakdown(opt('a'), criteria, scores)
    // Only cost contributes: 0.6*10 = 6, NOT renormalized to 10
    expect(breakdown.weightedTotal).toBeCloseTo(6)
    expect(breakdown.missingCells).toBe(1)
  })

  it('reports rawScore null and zero contribution for missing cells', () => {
    const criteria = [crit('cost', 100)]
    const breakdown = computeOptionBreakdown(opt('a'), criteria, [])
    expect(breakdown.perCriterion[0]).toEqual({
      criterionId: 'cost',
      rawScore: null,
      weight: 100,
      contribution: 0,
    })
  })
})

describe('computeDecisionResult', () => {
  it('ranks options descending by weightedTotal', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 3), score('b', 'c1', 9)],
    })
    const result = computeDecisionResult(d)
    expect(result.ranking).toEqual(['b', 'a'])
    expect(result.winnerOptionIds).toEqual(['b'])
  })

  it('detects an exact tie and lists all tied options as winners', () => {
    const d = decision({
      options: [opt('a'), opt('b'), opt('c')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7), score('b', 'c1', 7), score('c', 'c1', 2)],
    })
    const result = computeDecisionResult(d)
    expect(result.winnerOptionIds.sort()).toEqual(['a', 'b'])
    expect(result.ranking[0]).toBe('a') // stable: original input order preserved among ties
    expect(result.ranking[1]).toBe('b')
  })

  it('is isComplete=true only when every option has every criterion scored', () => {
    const complete = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 5)],
    })
    expect(computeDecisionResult(complete).isComplete).toBe(true)

    const incomplete = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 50), crit('c2', 50)],
      scores: [score('a', 'c1', 5), score('a', 'c2', 5), score('b', 'c1', 5)],
    })
    expect(computeDecisionResult(incomplete).isComplete).toBe(false)
  })

  it('handles zero options gracefully', () => {
    const d = decision({ options: [], criteria: [crit('c1', 100)], scores: [] })
    const result = computeDecisionResult(d)
    expect(result.breakdowns).toEqual([])
    expect(result.ranking).toEqual([])
    expect(result.winnerOptionIds).toEqual([])
  })

  it('treats zero criteria as incomplete (nothing to score against)', () => {
    const d = decision({ options: [opt('a')], criteria: [], scores: [] })
    const result = computeDecisionResult(d)
    expect(result.isComplete).toBe(false)
    expect(result.breakdowns[0].weightedTotal).toBe(0)
  })

  it('handles a single option with a single criterion', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 10)],
    })
    const result = computeDecisionResult(d)
    expect(result.winnerOptionIds).toEqual(['a'])
    expect(result.breakdowns[0].weightedTotal).toBe(10)
  })
})
