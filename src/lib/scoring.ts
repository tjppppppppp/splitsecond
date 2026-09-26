// Deterministic weighted-sum scoring engine.
//
// No React, DOM, or AI-related imports allowed in this file. This is the one
// place the decision's ranking/winner is computed, and it must stay a pure,
// fully unit-tested function of its inputs.

import type { Criterion, Decision, DecisionResult, Option, OptionScoreBreakdown, Score } from './types'

const TIE_EPSILON = 1e-9

function findScore(scores: Score[], optionId: string, criterionId: string): Score | undefined {
  return scores.find((s) => s.optionId === optionId && s.criterionId === criterionId)
}

export function computeOptionBreakdown(
  option: Option,
  criteria: Criterion[],
  scores: Score[],
): OptionScoreBreakdown {
  let weightedTotal = 0
  let missingCells = 0
  const perCriterion = criteria.map((criterion) => {
    const score = findScore(scores, option.id, criterion.id)
    const rawScore = score?.value ?? null
    let contribution = 0
    if (rawScore === null) {
      missingCells += 1
    } else {
      contribution = (criterion.weight / 100) * rawScore
      weightedTotal += contribution
    }
    return {
      criterionId: criterion.id,
      rawScore,
      weight: criterion.weight,
      contribution,
    }
  })

  return {
    optionId: option.id,
    weightedTotal,
    perCriterion,
    missingCells,
  }
}

export function computeDecisionResult(decision: Decision): DecisionResult {
  const breakdowns = decision.options.map((option) =>
    computeOptionBreakdown(option, decision.criteria, decision.scores),
  )

  const ranking = [...breakdowns]
    .map((b, index) => ({ b, index }))
    // Stable sort descending by weightedTotal; ties keep original input order.
    .sort((a, z) => {
      const diff = z.b.weightedTotal - a.b.weightedTotal
      if (Math.abs(diff) < TIE_EPSILON) return a.index - z.index
      return diff
    })
    .map(({ b }) => b.optionId)

  let winnerOptionIds: string[] = []
  if (breakdowns.length > 0) {
    const topTotal = breakdowns.find((b) => b.optionId === ranking[0])!.weightedTotal
    winnerOptionIds = breakdowns
      .filter((b) => Math.abs(b.weightedTotal - topTotal) < TIE_EPSILON)
      .map((b) => b.optionId)
  }

  const isComplete = breakdowns.every((b) => b.missingCells === 0) && decision.criteria.length > 0

  return {
    decisionId: decision.id,
    computedAt: new Date().toISOString(),
    breakdowns,
    ranking,
    winnerOptionIds,
    isComplete,
  }
}
