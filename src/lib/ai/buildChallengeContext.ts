// Builds the read-only context sent to the AI challenge function. This is a
// pure function: it never calls the network and never mutates its inputs.

import type { Decision, DecisionResult, SensitivityResult } from '../types'

export interface ChallengeRequestContext {
  decisionTitle: string
  decisionDescription?: string
  options: { id: string; name: string; description?: string }[]
  criteria: { id: string; name: string; description?: string; weight: number }[]
  scores: { optionId: string; criterionId: string; value: number | null; reasoning: string }[]
  deterministicResult: DecisionResult
  sensitivitySummary: {
    overallRobustness: SensitivityResult['overallRobustness']
    topFragilePivots: string[]
  }
}

function optionName(decision: Decision, id: string): string {
  return decision.options.find((o) => o.id === id)?.name ?? id
}

function criterionName(decision: Decision, id: string): string {
  return decision.criteria.find((c) => c.id === id)?.name ?? id
}

function formatWeightPivot(decision: Decision, pivot: SensitivityResult['weightPivots'][number]): string | null {
  if (pivot.minWeightDeltaToFlip === null) return null
  const name = criterionName(decision, pivot.criterionId)
  return `Winner flips if "${name}"'s weight changes by ${pivot.minWeightDeltaToFlip} point(s)`
}

function formatScorePivot(decision: Decision, pivot: SensitivityResult['scorePivots'][number]): string | null {
  if (pivot.minScoreDeltaToFlip === null) return null
  const option = optionName(decision, pivot.optionId)
  const criterion = criterionName(decision, pivot.criterionId)
  return `Winner flips if "${option}"'s "${criterion}" score changes by ${pivot.minScoreDeltaToFlip} point(s)`
}

export function buildChallengeContext(
  decision: Decision,
  result: DecisionResult,
  sensitivity: SensitivityResult,
): ChallengeRequestContext {
  const pivotStrings: string[] = []
  if (sensitivity.applicable) {
    for (const p of sensitivity.weightPivots.slice(0, 3)) {
      const s = formatWeightPivot(decision, p)
      if (s) pivotStrings.push(s)
    }
    for (const p of sensitivity.scorePivots.slice(0, 3)) {
      const s = formatScorePivot(decision, p)
      if (s) pivotStrings.push(s)
    }
  }

  return {
    decisionTitle: decision.title,
    decisionDescription: decision.description,
    options: decision.options.map((o) => ({ id: o.id, name: o.name, description: o.description })),
    criteria: decision.criteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      weight: c.weight,
    })),
    scores: decision.scores.map((s) => ({
      optionId: s.optionId,
      criterionId: s.criterionId,
      value: s.value,
      reasoning: s.reasoning,
    })),
    deterministicResult: result,
    sensitivitySummary: {
      overallRobustness: sensitivity.overallRobustness,
      topFragilePivots: pivotStrings.slice(0, 5),
    },
  }
}
