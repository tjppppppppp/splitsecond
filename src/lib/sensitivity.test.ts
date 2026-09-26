import { describe, expect, it } from 'vitest'
import { computeDecisionResult } from './scoring'
import { ROBUSTNESS_THRESHOLDS, computeSensitivityResult, redistributeWeights } from './sensitivity'
import type { Criterion, Decision, Option, Score } from './types'

function opt(id: string): Option {
  return { id, name: id }
}
function crit(id: string, weight: number): Criterion {
  return { id, name: id, weight }
}
function score(optionId: string, criterionId: string, value: number): Score {
  return { optionId, criterionId, value, reasoning: 'r' }
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

// ---- Fixtures with hand-verified flip points ----

// Fixture A: fragile. a wins 6.8 vs 6.6 (margin 0.2). Weight flip on c1 at
// magnitude 3 (decrease); score flips at magnitude 1 on several cells.
const fixtureA = decision({
  options: [opt('a'), opt('b')],
  criteria: [crit('c1', 60), crit('c2', 40)],
  scores: [score('a', 'c1', 8), score('a', 'c2', 5), score('b', 'c1', 5), score('b', 'c2', 9)],
})

// Fixture B: robust. a dominates so heavily nothing flips within valid ranges.
const fixtureB = decision({
  options: [opt('a'), opt('b')],
  criteria: [crit('c1', 50), crit('c2', 50)],
  scores: [score('a', 'c1', 10), score('a', 'c2', 10), score('b', 'c1', 1), score('b', 'c2', 1)],
})

// Fixture C: moderate. a wins 7.01 vs 6.32 (margin 0.69). Weight flip on c1
// at magnitude 10 (decrease); score flips at magnitude >= 2 (fraction ~0.22).
const fixtureC = decision({
  options: [opt('a'), opt('b')],
  criteria: [crit('c1', 67), crit('c2', 33)],
  scores: [score('a', 'c1', 8), score('a', 'c2', 5), score('b', 'c1', 5), score('b', 'c2', 9)],
})

// Fixture D: a slightly larger, non-hand-verified fixture used purely for the
// binary-search-vs-brute-force cross-check across more options/criteria.
const fixtureD = decision({
  options: [opt('a'), opt('b'), opt('c')],
  criteria: [crit('c1', 50), crit('c2', 30), crit('c3', 20)],
  scores: [
    score('a', 'c1', 7),
    score('a', 'c2', 4),
    score('a', 'c3', 9),
    score('b', 'c1', 6),
    score('b', 'c2', 8),
    score('b', 'c3', 3),
    score('c', 'c1', 5),
    score('c', 'c2', 5),
    score('c', 'c3', 5),
  ],
})

describe('redistributeWeights', () => {
  it('always sums to exactly 100 after redistribution, including uneven splits', () => {
    const criteria = [crit('a', 34), crit('b', 33), crit('c', 33)]
    for (const delta of [1, -1, 5, -5, 17, -17, 66, -33]) {
      const result = redistributeWeights(criteria, 'a', delta)
      const sum = result.reduce((s, c) => s + c.weight, 0)
      expect(sum).toBe(100)
    }
  })

  it('clamps the target weight to [0, 100]', () => {
    const criteria = [crit('a', 90), crit('b', 10)]
    const result = redistributeWeights(criteria, 'a', 50)
    expect(result.find((c) => c.id === 'a')!.weight).toBe(100)
    const sum = result.reduce((s, c) => s + c.weight, 0)
    expect(sum).toBe(100)
  })

  it('falls back to an even split when all other weights are 0', () => {
    const criteria = [crit('a', 100), crit('b', 0), crit('c', 0)]
    const result = redistributeWeights(criteria, 'a', -10)
    expect(result.find((c) => c.id === 'a')!.weight).toBe(90)
    const sum = result.reduce((s, c) => s + c.weight, 0)
    expect(sum).toBe(100)
  })
})

describe('computeSensitivityResult - applicability', () => {
  it('is inapplicable with fewer than 2 options', () => {
    const d = decision({ options: [opt('a')], criteria: [crit('c1', 50), crit('c2', 50)] })
    const result = computeSensitivityResult(d)
    expect(result.applicable).toBe(false)
    expect(result.overallRobustness).toBe('indeterminate')
    expect(result.inapplicableReason).toBeTruthy()
  })

  it('is inapplicable with fewer than 2 criteria', () => {
    const d = decision({ options: [opt('a'), opt('b')], criteria: [crit('c1', 100)] })
    const result = computeSensitivityResult(d)
    expect(result.applicable).toBe(false)
    expect(result.weightPivots).toEqual([])
    expect(result.scorePivots).toEqual([])
  })
})

describe('computeSensitivityResult - hand-verified fixtures', () => {
  it('fixture A: classifies as fragile with a weight flip at magnitude 3', () => {
    const result = computeSensitivityResult(fixtureA)
    expect(result.applicable).toBe(true)
    expect(result.overallRobustness).toBe('fragile')
    expect(result.robustnessBasis.kind).toBe('weight')
    expect(result.robustnessBasis.minDelta).toBe(3)

    const c1Pivot = result.weightPivots.find((p) => p.criterionId === 'c1')!
    expect(c1Pivot.minWeightDeltaToFlip).toBe(3)
    expect(c1Pivot.direction).toBe('decrease')
    expect(c1Pivot.newWinnerOptionId).toBe('b')

    const c2Pivot = result.weightPivots.find((p) => p.criterionId === 'c2')!
    expect(c2Pivot.minWeightDeltaToFlip).toBe(3)
    expect(c2Pivot.direction).toBe('increase')
  })

  it('fixture B: classifies as robust with no flips found anywhere', () => {
    const result = computeSensitivityResult(fixtureB)
    expect(result.overallRobustness).toBe('robust')
    expect(result.robustnessBasis).toEqual({ kind: 'none', minDelta: null })
    expect(result.weightPivots.every((p) => p.minWeightDeltaToFlip === null)).toBe(true)
    expect(result.scorePivots.every((p) => p.minScoreDeltaToFlip === null)).toBe(true)
  })

  it('fixture C: classifies as moderate with a weight flip at magnitude 10', () => {
    const result = computeSensitivityResult(fixtureC)
    expect(result.overallRobustness).toBe('moderate')
    const c1Pivot = result.weightPivots.find((p) => p.criterionId === 'c1')!
    expect(c1Pivot.minWeightDeltaToFlip).toBe(10)
    expect(c1Pivot.direction).toBe('decrease')
  })

  it('robustness threshold constants match the documented boundaries', () => {
    expect(ROBUSTNESS_THRESHOLDS.robust).toBe(0.15)
    expect(ROBUSTNESS_THRESHOLDS.moderate).toBe(0.05)
  })
})

// ---- Brute-force oracle cross-check ----
//
// Independently re-derives the minimal flip magnitude by linearly scanning
// every integer step (slow but unambiguous), and asserts it matches the
// production binary-search result exactly, for every criterion/cell across
// several fixtures.

function bruteForceWeightFlip(
  d: Decision,
  criterionId: string,
  direction: 'increase' | 'decrease',
  maxMagnitude: number,
  originalWinners: string[],
): number | null {
  for (let m = 1; m <= maxMagnitude; m++) {
    const delta = direction === 'increase' ? m : -m
    const newCriteria = redistributeWeights(d.criteria, criterionId, delta)
    const perturbed = { ...d, criteria: newCriteria }
    const winners = computeDecisionResult(perturbed).winnerOptionIds
    const same =
      winners.length === originalWinners.length &&
      [...winners].sort().every((id, i) => id === [...originalWinners].sort()[i])
    if (!same) return m
  }
  return null
}

function bruteForceScoreFlip(
  d: Decision,
  optionId: string,
  criterionId: string,
  currentValue: number,
  direction: 'increase' | 'decrease',
  maxMagnitude: number,
  originalWinners: string[],
): number | null {
  for (let m = 1; m <= maxMagnitude; m++) {
    const newValue = direction === 'increase' ? currentValue + m : currentValue - m
    const newScores = d.scores.map((s) =>
      s.optionId === optionId && s.criterionId === criterionId ? { ...s, value: newValue } : s,
    )
    const perturbed = { ...d, scores: newScores }
    const winners = computeDecisionResult(perturbed).winnerOptionIds
    const same =
      winners.length === originalWinners.length &&
      [...winners].sort().every((id, i) => id === [...originalWinners].sort()[i])
    if (!same) return m
  }
  return null
}

describe('binary search matches brute-force oracle', () => {
  const fixtures = [fixtureA, fixtureB, fixtureC, fixtureD]

  it('weight pivots match the brute-force oracle on every fixture/criterion/direction', () => {
    for (const d of fixtures) {
      const originalWinners = computeDecisionResult(d).winnerOptionIds
      const result = computeSensitivityResult(d)
      if (!result.applicable) continue

      for (const criterion of d.criteria) {
        const increaseOracle = bruteForceWeightFlip(
          d,
          criterion.id,
          'increase',
          100 - criterion.weight,
          originalWinners,
        )
        const decreaseOracle = bruteForceWeightFlip(
          d,
          criterion.id,
          'decrease',
          criterion.weight,
          originalWinners,
        )
        const expectedMin =
          increaseOracle === null
            ? decreaseOracle
            : decreaseOracle === null
              ? increaseOracle
              : Math.min(increaseOracle, decreaseOracle)

        const pivot = result.weightPivots.find((p) => p.criterionId === criterion.id)!
        expect(pivot.minWeightDeltaToFlip).toBe(expectedMin)
      }
    }
  })

  it('score pivots match the brute-force oracle on every fixture/cell/direction', () => {
    for (const d of fixtures) {
      const originalWinners = computeDecisionResult(d).winnerOptionIds
      const result = computeSensitivityResult(d)
      if (!result.applicable) continue

      for (const opt_ of d.options) {
        for (const criterion of d.criteria) {
          const s = d.scores.find((sc) => sc.optionId === opt_.id && sc.criterionId === criterion.id)
          if (!s || s.value === null) continue
          const currentValue = s.value

          const increaseOracle = bruteForceScoreFlip(
            d,
            opt_.id,
            criterion.id,
            currentValue,
            'increase',
            10 - currentValue,
            originalWinners,
          )
          const decreaseOracle = bruteForceScoreFlip(
            d,
            opt_.id,
            criterion.id,
            currentValue,
            'decrease',
            currentValue - 1,
            originalWinners,
          )
          const expectedMin =
            increaseOracle === null
              ? decreaseOracle
              : decreaseOracle === null
                ? increaseOracle
                : Math.min(increaseOracle, decreaseOracle)

          const pivot = result.scorePivots.find(
            (p) => p.optionId === opt_.id && p.criterionId === criterion.id,
          )!
          expect(pivot.minScoreDeltaToFlip).toBe(expectedMin)
        }
      }
    }
  })
})
