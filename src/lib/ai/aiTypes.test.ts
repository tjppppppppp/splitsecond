import { describe, expect, it } from 'vitest'
import { parseChallengeResult } from './aiTypes'

function validPayload() {
  return {
    schemaVersion: 1 as const,
    missingCriteria: [{ suggestion: 'Consider commute time', rationale: 'Not mentioned anywhere' }],
    unsupportedAssumptions: [
      {
        location: { optionId: 'a', criterionId: 'c1' },
        assumption: 'Assumes remote work stays permanent',
        whyUnsupported: 'No evidence cited',
      },
    ],
    doubleCountedFactors: [{ criterionIds: ['c1', 'c2'], explanation: 'Both capture cost' }],
    uncertaintyFlags: [{ location: { optionId: 'b', criterionId: 'c2' }, concern: 'Score seems guessed' }],
    biasFlags: [{ biasType: 'anchoring', explanation: 'First number considered dominates' }],
    whatWouldChangeYourMind: [
      { statement: 'If the commute were under 30 minutes', relatedCriterionIds: ['c1'] },
    ],
    overallReasoningQualityNote: 'Reasoning is thin on two criteria.',
  }
}

describe('ChallengeResult schema', () => {
  it('accepts a well-formed valid payload', () => {
    const result = parseChallengeResult(validPayload())
    expect(result.success).toBe(true)
  })

  it('rejects a stray numeric score at the top level', () => {
    const payload = { ...validPayload(), score: 8.5 }
    expect(parseChallengeResult(payload).success).toBe(false)
  })

  it('rejects a stray weight field at the top level', () => {
    const payload = { ...validPayload(), weight: 100 }
    expect(parseChallengeResult(payload).success).toBe(false)
  })

  it('rejects a stray ranking/winner field at the top level', () => {
    expect(parseChallengeResult({ ...validPayload(), ranking: ['a', 'b'] }).success).toBe(false)
    expect(parseChallengeResult({ ...validPayload(), winner: 'a' }).success).toBe(false)
  })

  it('rejects a numeric confidence field inside biasFlags', () => {
    const payload = validPayload()
    payload.biasFlags = [{ ...payload.biasFlags[0], confidence: 0.9 } as never]
    expect(parseChallengeResult(payload).success).toBe(false)
  })

  it('rejects a numeric score field nested inside unsupportedAssumptions', () => {
    const payload = validPayload()
    payload.unsupportedAssumptions = [
      { ...payload.unsupportedAssumptions[0], score: 3 } as never,
    ]
    expect(parseChallengeResult(payload).success).toBe(false)
  })

  it('rejects a numeric field inside whatWouldChangeYourMind', () => {
    const payload = validPayload()
    payload.whatWouldChangeYourMind = [
      { ...payload.whatWouldChangeYourMind[0], confidence: 7 } as never,
    ]
    expect(parseChallengeResult(payload).success).toBe(false)
  })

  it('rejects an extra unrecognized top-level key entirely', () => {
    expect(parseChallengeResult({ ...validPayload(), recommendedOption: 'a' }).success).toBe(false)
  })
})
