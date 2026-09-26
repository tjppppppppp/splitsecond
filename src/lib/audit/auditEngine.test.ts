import { describe, expect, it } from 'vitest'
import { computeDecisionResult } from '../scoring'
import { computeSensitivityResult } from '../sensitivity'
import { computeReasoningAudit } from './auditEngine'
import type { Criterion, Decision, Option, Score } from '../types'

function opt(id: string, name = id): Option {
  return { id, name }
}
function crit(id: string, weight: number, name = id): Criterion {
  return { id, name, weight }
}
function score(optionId: string, criterionId: string, value: number | null, reasoning = ''): Score {
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

function audit(d: Decision) {
  const result = computeDecisionResult(d)
  const sensitivity = computeSensitivityResult(d)
  return computeReasoningAudit(d, result, sensitivity)
}

// schemaVersion is a literal internal version tag (always 1), not a
// score/weight/ranking/confidence content field -- it's excluded from this
// check on purpose, the same way it was on the old ChallengeResult type.
function assertNoNumericLeaves(value: unknown, path = 'root'): void {
  if (typeof value === 'number') {
    throw new Error(`Numeric leaf found at ${path}`)
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNumericLeaves(v, `${path}[${i}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'schemaVersion') continue
      assertNoNumericLeaves(v, `${path}.${k}`)
    }
  }
}

describe('computeReasoningAudit: unsupported / weakly-justified scores', () => {
  it('flags a score with no reasoning at all', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7, '')],
    })
    const result = audit(d)
    expect(result.unsupportedAssumptions).toHaveLength(1)
    expect(result.unsupportedAssumptions[0].whyUnsupported).toContain('No reasoning was given')
  })

  it('flags a score with very brief reasoning', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7, 'seems fine')],
    })
    const result = audit(d)
    expect(result.unsupportedAssumptions).toHaveLength(1)
    expect(result.unsupportedAssumptions[0].whyUnsupported).toContain('very brief')
  })

  it('does not flag a score with adequate reasoning', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7, 'This option has a strong track record on this specific criterion.')],
    })
    const result = audit(d)
    expect(result.unsupportedAssumptions).toHaveLength(0)
  })
})

describe('computeReasoningAudit: large score spread with weak justification', () => {
  const thinReasoning = 'Seems reasonable based on limited info'
  const substantialReasoning =
    'I did extensive research and compared many similar products carefully before settling on this number.'

  it('flags a large spread when reasoning is thin on both ends', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 9, thinReasoning), score('b', 'c1', 3, thinReasoning)],
    })
    const result = audit(d)
    expect(result.uncertaintyFlags.some((f) => f.concern.includes('scores range from'))).toBe(true)
  })

  it('does not flag when at least one end has substantial reasoning', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 9, substantialReasoning), score('b', 'c1', 3, thinReasoning)],
    })
    const result = audit(d)
    expect(result.uncertaintyFlags.some((f) => f.concern.includes('scores range from'))).toBe(false)
  })

  it('does not flag when the spread is small', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 6, thinReasoning), score('b', 'c1', 5, thinReasoning)],
    })
    const result = audit(d)
    expect(result.uncertaintyFlags.some((f) => f.concern.includes('scores range from'))).toBe(false)
  })
})

describe('computeReasoningAudit: duplicated / overlapping criteria', () => {
  it('flags two criteria that score every option identically', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 50, 'Build quality'), crit('c2', 50, 'Durability')],
      scores: [
        score('a', 'c1', 8, 'good'), score('a', 'c2', 8, 'good'),
        score('b', 'c1', 4, 'meh'), score('b', 'c2', 4, 'meh'),
      ],
    })
    const result = audit(d)
    expect(
      result.doubleCountedFactors.some((f) => f.explanation.includes('score every option identically')),
    ).toBe(true)
  })

  it('flags two criteria with overlapping/similar names', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 50, 'Cost'), crit('c2', 50, 'Total Cost')],
      scores: [score('a', 'c1', 8, 'fine'), score('a', 'c2', 3, 'different')],
    })
    const result = audit(d)
    expect(result.doubleCountedFactors.some((f) => f.explanation.includes('similar names'))).toBe(true)
  })

  it('does not flag distinct criteria with different names and scores', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 50, 'Price'), crit('c2', 50, 'Comfort')],
      scores: [
        score('a', 'c1', 8, 'good'), score('a', 'c2', 3, 'meh'),
        score('b', 'c1', 4, 'meh'), score('b', 'c2', 9, 'great'),
      ],
    })
    const result = audit(d)
    expect(result.doubleCountedFactors).toHaveLength(0)
  })
})

describe('computeReasoningAudit: extreme criterion weight', () => {
  it('flags a criterion at or above the extreme-weight threshold', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 60, 'Cost'), crit('c2', 40, 'Comfort')],
      scores: [score('a', 'c1', 7, 'a reasonable amount of detail here'), score('a', 'c2', 6, 'a reasonable amount of detail here')],
    })
    const result = audit(d)
    expect(result.biasFlags.some((f) => f.biasType === 'Single-factor dominance')).toBe(true)
  })

  it('does not flag balanced weights', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 40, 'Cost'), crit('c2', 30, 'Comfort'), crit('c3', 30, 'Style')],
      scores: [
        score('a', 'c1', 7, 'a reasonable amount of detail here'),
        score('a', 'c2', 6, 'a reasonable amount of detail here'),
        score('a', 'c3', 5, 'a reasonable amount of detail here'),
      ],
    })
    const result = audit(d)
    expect(result.biasFlags.some((f) => f.biasType === 'Single-factor dominance')).toBe(false)
  })
})

describe('computeReasoningAudit: outcome hinges on one criterion', () => {
  it('flags a criterion whose small weight change flips the winner (near-tied decision)', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 50, 'Cost'), crit('c2', 50, 'Comfort')],
      scores: [
        score('a', 'c1', 7, 'a reasonable amount of detail here'),
        score('a', 'c2', 7, 'a reasonable amount of detail here'),
        score('b', 'c1', 8, 'a reasonable amount of detail here'),
        score('b', 'c2', 6, 'a reasonable amount of detail here'),
      ],
    })
    const sensitivity = computeSensitivityResult(d)
    const fragilePivot = sensitivity.weightPivots.find((p) => p.minWeightDeltaToFlip !== null && p.minWeightDeltaToFlip <= 5)
    expect(fragilePivot).toBeDefined() // sanity-check the fixture is actually fragile

    const result = audit(d)
    expect(result.biasFlags.some((f) => f.biasType === 'Outcome hinges on one criterion')).toBe(true)
  })

  it('does not flag when the decision is robust to weight changes', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 50, 'Cost'), crit('c2', 50, 'Comfort')],
      scores: [
        score('a', 'c1', 9, 'a reasonable amount of detail here'),
        score('a', 'c2', 9, 'a reasonable amount of detail here'),
        score('b', 'c1', 1, 'a reasonable amount of detail here'),
        score('b', 'c2', 1, 'a reasonable amount of detail here'),
      ],
    })
    const sensitivity = computeSensitivityResult(d)
    expect(sensitivity.weightPivots.every((p) => p.minWeightDeltaToFlip === null)).toBe(true)

    const result = audit(d)
    expect(result.biasFlags.some((f) => f.biasType === 'Outcome hinges on one criterion')).toBe(false)
  })
})

describe('computeReasoningAudit: hedging language', () => {
  it('flags reasoning that hedges', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7, 'I think this is probably a decent choice overall')],
    })
    const result = audit(d)
    expect(result.uncertaintyFlags.some((f) => f.concern.includes('hedges'))).toBe(true)
  })

  it('does not flag confident reasoning', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7, 'This option has a strong track record on this specific criterion.')],
    })
    const result = audit(d)
    expect(result.uncertaintyFlags.some((f) => f.concern.includes('hedges'))).toBe(false)
  })
})

describe('computeReasoningAudit: what would change your mind', () => {
  it('derives statements from real sensitivity pivots for a fragile decision', () => {
    const d = decision({
      options: [opt('a', 'Alpha'), opt('b', 'Beta')],
      criteria: [crit('c1', 50, 'Cost'), crit('c2', 50, 'Comfort')],
      scores: [
        score('a', 'c1', 7, 'a reasonable amount of detail here'),
        score('a', 'c2', 7, 'a reasonable amount of detail here'),
        score('b', 'c1', 8, 'a reasonable amount of detail here'),
        score('b', 'c2', 6, 'a reasonable amount of detail here'),
      ],
    })
    const result = audit(d)
    expect(result.whatWouldChangeYourMind.length).toBeGreaterThan(0)
    expect(result.whatWouldChangeYourMind[0].statement).toMatch(/winner would change to/)
  })

  it('falls back to a single robust-decision statement when nothing flips', () => {
    const d = decision({
      options: [opt('a'), opt('b')],
      criteria: [crit('c1', 50), crit('c2', 50)],
      scores: [
        score('a', 'c1', 9, 'a reasonable amount of detail here'),
        score('a', 'c2', 9, 'a reasonable amount of detail here'),
        score('b', 'c1', 1, 'a reasonable amount of detail here'),
        score('b', 'c2', 1, 'a reasonable amount of detail here'),
      ],
    })
    const result = audit(d)
    expect(result.whatWouldChangeYourMind).toHaveLength(1)
    expect(result.whatWouldChangeYourMind[0].statement).toContain('appears robust')
    expect(result.whatWouldChangeYourMind[0].relatedCriterionIds).toHaveLength(0)
  })

  it('falls back to the robust statement when sensitivity is not applicable', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 100)],
      scores: [score('a', 'c1', 7, 'a reasonable amount of detail here')],
    })
    const result = audit(d)
    expect(result.whatWouldChangeYourMind).toHaveLength(1)
    expect(result.whatWouldChangeYourMind[0].statement).toContain('appears robust')
  })
})

describe('computeReasoningAudit: missing criteria heuristic', () => {
  it('flags too few criteria (< 3)', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 50), crit('c2', 50)],
      scores: [score('a', 'c1', 7, 'a reasonable amount of detail here'), score('a', 'c2', 6, 'a reasonable amount of detail here')],
    })
    const result = audit(d)
    expect(result.missingCriteria).toHaveLength(1)
  })

  it('does not flag when there are 3 or more criteria', () => {
    const d = decision({
      options: [opt('a')],
      criteria: [crit('c1', 34), crit('c2', 33), crit('c3', 33)],
      scores: [
        score('a', 'c1', 7, 'a reasonable amount of detail here'),
        score('a', 'c2', 6, 'a reasonable amount of detail here'),
        score('a', 'c3', 5, 'a reasonable amount of detail here'),
      ],
    })
    const result = audit(d)
    expect(result.missingCriteria).toHaveLength(0)
  })
})

describe('computeReasoningAudit: schema-level invariant', () => {
  it('never produces a numeric leaf value anywhere in the result', () => {
    // A "dirty" decision that should trigger most categories at once.
    const d = decision({
      options: [opt('a', 'Alpha'), opt('b', 'Beta')],
      criteria: [crit('c1', 60, 'Cost'), crit('c2', 40, 'Total Cost')],
      scores: [
        score('a', 'c1', 9, ''),
        score('a', 'c2', 3, 'maybe'),
        score('b', 'c1', 8, 'ok'),
        score('b', 'c2', 6, 'I guess this is fine'),
      ],
    })
    const result = audit(d)
    assertNoNumericLeaves(result)
  })
})
