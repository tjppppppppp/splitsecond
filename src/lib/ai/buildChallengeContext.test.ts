import { describe, expect, it } from 'vitest'
import { buildChallengeContext } from './buildChallengeContext'
import { computeDecisionResult } from '../scoring'
import { computeSensitivityResult } from '../sensitivity'
import type { Decision } from '../types'

const decision: Decision = {
  id: 'd1',
  schemaVersion: 1,
  title: 'Which job offer?',
  description: 'Comparing two offers',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  options: [
    { id: 'a', name: 'Offer A' },
    { id: 'b', name: 'Offer B' },
  ],
  criteria: [
    { id: 'c1', name: 'Salary', weight: 60 },
    { id: 'c2', name: 'Growth', weight: 40 },
  ],
  scores: [
    { optionId: 'a', criterionId: 'c1', value: 8, reasoning: 'Higher base' },
    { optionId: 'a', criterionId: 'c2', value: 5, reasoning: 'Slower promo track' },
    { optionId: 'b', criterionId: 'c1', value: 5, reasoning: 'Lower base' },
    { optionId: 'b', criterionId: 'c2', value: 9, reasoning: 'Fast-growing team' },
  ],
}

describe('buildChallengeContext', () => {
  it('includes read-only decision content, the deterministic result, and a trimmed sensitivity summary', () => {
    const result = computeDecisionResult(decision)
    const sensitivity = computeSensitivityResult(decision)
    const context = buildChallengeContext(decision, result, sensitivity)

    expect(context.decisionTitle).toBe('Which job offer?')
    expect(context.options).toHaveLength(2)
    expect(context.criteria).toHaveLength(2)
    expect(context.scores).toHaveLength(4)
    expect(context.deterministicResult).toEqual(result)
    expect(context.sensitivitySummary.overallRobustness).toBe(sensitivity.overallRobustness)
    expect(context.sensitivitySummary.topFragilePivots.length).toBeGreaterThan(0)
    expect(context.sensitivitySummary.topFragilePivots[0]).toContain('Winner flips if')
  })

  it('produces no pivot strings when sensitivity is inapplicable', () => {
    const single: Decision = { ...decision, options: [decision.options[0]] }
    const result = computeDecisionResult(single)
    const sensitivity = computeSensitivityResult(single)
    const context = buildChallengeContext(single, result, sensitivity)
    expect(context.sensitivitySummary.topFragilePivots).toEqual([])
  })

  it('never includes any numeric score/weight/ranking field outside the deterministic result itself', () => {
    const result = computeDecisionResult(decision)
    const sensitivity = computeSensitivityResult(decision)
    const context = buildChallengeContext(decision, result, sensitivity)
    // Everything outside deterministicResult/sensitivitySummary must be pure content.
    for (const c of context.criteria) {
      expect(typeof c.weight).toBe('number') // the ONLY numeric field, and it's the input weight, not an AI output
    }
    expect(context.options.every((o) => typeof o.name === 'string')).toBe(true)
  })
})
