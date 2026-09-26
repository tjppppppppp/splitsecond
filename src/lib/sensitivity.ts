// Deterministic sensitivity analysis: no randomness, no Monte Carlo.
//
// Two sweeps (weight-perturbation "tornado" and score-pivot) plus an overall
// robustness classification. The score-pivot sweep uses binary search (pure
// linear function of one score, safe to bisect). The weight-perturbation
// sweep uses a linear scan instead -- integer rounding in redistribution
// breaks the strict monotonicity binary search requires (see the comment in
// findWeightFlip). No React, DOM, or AI-related imports allowed in this file.

import { computeDecisionResult } from './scoring'
import type {
  Criterion,
  Decision,
  RobustnessLevel,
  ScorePivot,
  SensitivityResult,
  WeightPivot,
} from './types'

export const ROBUSTNESS_THRESHOLDS = {
  /** minDelta fraction > this => robust */
  robust: 0.15,
  /** minDelta fraction > this (and <= robust) => moderate; <= this => fragile */
  moderate: 0.05,
} as const

const MIN_OPTIONS_FOR_SENSITIVITY = 2
const MIN_CRITERIA_FOR_SENSITIVITY = 2

function sameWinnerSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((id, i) => id === sortedB[i])
}

/**
 * Redistribute a weight delta on `criterionId` proportionally across the
 * other criteria, with a rounding-residual correction so the total always
 * sums to exactly 100.
 */
export function redistributeWeights(
  criteria: Criterion[],
  criterionId: string,
  delta: number,
): Criterion[] {
  const targetIndex = criteria.findIndex((c) => c.id === criterionId)
  if (targetIndex === -1) return criteria
  const target = criteria[targetIndex]
  const others = criteria.filter((c) => c.id !== criterionId)

  const clampedTarget = Math.max(0, Math.min(100, target.weight + delta))
  const actualDelta = clampedTarget - target.weight
  const otherSum = others.reduce((s, c) => s + c.weight, 0)

  let newOtherWeights: number[]
  if (others.length === 0) {
    newOtherWeights = []
  } else if (otherSum === 0) {
    const share = actualDelta / others.length
    newOtherWeights = others.map((o) => o.weight - share)
  } else {
    newOtherWeights = others.map((o) => o.weight - actualDelta * (o.weight / otherSum))
  }

  const rounded = newOtherWeights.map((w) => Math.max(0, Math.min(100, Math.round(w))))

  // Rounding-residual correction: force the total back to exactly 100 by
  // applying the leftover to the largest-weight remaining criteria in turn.
  let total = clampedTarget + rounded.reduce((s, w) => s + w, 0)
  let residual = 100 - total
  const order = rounded
    .map((_, i) => i)
    .sort((i, j) => rounded[j] - rounded[i])
  for (const i of order) {
    if (residual === 0) break
    const room =
      residual > 0 ? 100 - rounded[i] /* room to grow */ : rounded[i] /* room to shrink */
    const applied = residual > 0 ? Math.min(residual, room) : Math.max(residual, -room)
    rounded[i] += applied
    residual -= applied
  }

  const result: Criterion[] = criteria.map((c) => c)
  result[targetIndex] = { ...target, weight: clampedTarget }
  others.forEach((o, i) => {
    const idx = result.findIndex((c) => c.id === o.id)
    result[idx] = { ...o, weight: rounded[i] }
  })
  return result
}

function findWeightFlip(
  decision: Decision,
  criterionId: string,
  originalWinners: string[],
  direction: 'increase' | 'decrease',
  maxMagnitude: number,
): { magnitude: number; newWinnerOptionId: string } | null {
  if (maxMagnitude <= 0) return null

  // NOTE: a plain linear scan, not binary search. Weight redistribution
  // rounds to integers and applies a residual correction (see
  // redistributeWeights), which can introduce small non-monotonic jitter in
  // the actual computed winner as magnitude increases -- confirmed by the
  // brute-force oracle cross-check in sensitivity.test.ts catching a real
  // divergence here. Binary search's correctness depends on strict
  // monotonicity, which rounding does not guarantee, so we scan instead.
  // The domain is at most 100 steps, so this is still trivially fast.
  for (let magnitude = 1; magnitude <= maxMagnitude; magnitude++) {
    const delta = direction === 'increase' ? magnitude : -magnitude
    const newCriteria = redistributeWeights(decision.criteria, criterionId, delta)
    const perturbed: Decision = { ...decision, criteria: newCriteria }
    const perturbedResult = computeDecisionResult(perturbed)
    if (!sameWinnerSet(perturbedResult.winnerOptionIds, originalWinners)) {
      return { magnitude, newWinnerOptionId: perturbedResult.ranking[0] }
    }
  }
  return null
}

function computeWeightPivots(decision: Decision, originalWinners: string[]): WeightPivot[] {
  const pivots: WeightPivot[] = decision.criteria.map((criterion) => {
    const increase = findWeightFlip(
      decision,
      criterion.id,
      originalWinners,
      'increase',
      100 - criterion.weight,
    )
    const decrease = findWeightFlip(
      decision,
      criterion.id,
      originalWinners,
      'decrease',
      criterion.weight,
    )

    let chosen: { magnitude: number; direction: 'increase' | 'decrease'; newWinnerOptionId: string } | null =
      null
    if (increase && decrease) {
      chosen =
        increase.magnitude <= decrease.magnitude
          ? { ...increase, direction: 'increase' }
          : { ...decrease, direction: 'decrease' }
    } else if (increase) {
      chosen = { ...increase, direction: 'increase' }
    } else if (decrease) {
      chosen = { ...decrease, direction: 'decrease' }
    }

    return {
      criterionId: criterion.id,
      currentWeight: criterion.weight,
      minWeightDeltaToFlip: chosen ? chosen.magnitude : null,
      direction: chosen ? chosen.direction : null,
      newWinnerOptionId: chosen ? chosen.newWinnerOptionId : null,
    }
  })

  return pivots.sort((a, z) => {
    if (a.minWeightDeltaToFlip === null) return 1
    if (z.minWeightDeltaToFlip === null) return -1
    return a.minWeightDeltaToFlip - z.minWeightDeltaToFlip
  })
}

function findScoreFlip(
  decision: Decision,
  optionId: string,
  criterionId: string,
  currentValue: number,
  originalWinners: string[],
  direction: 'increase' | 'decrease',
  maxMagnitude: number,
): { magnitude: number; newWinnerOptionId: string } | null {
  if (maxMagnitude <= 0) return null

  const resultAt = (magnitude: number) => {
    const newValue = direction === 'increase' ? currentValue + magnitude : currentValue - magnitude
    const newScores = decision.scores.map((s) =>
      s.optionId === optionId && s.criterionId === criterionId ? { ...s, value: newValue } : s,
    )
    const perturbed: Decision = { ...decision, scores: newScores }
    return computeDecisionResult(perturbed)
  }

  if (sameWinnerSet(resultAt(maxMagnitude).winnerOptionIds, originalWinners)) {
    return null
  }

  let lo = 1
  let hi = maxMagnitude
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (!sameWinnerSet(resultAt(mid).winnerOptionIds, originalWinners)) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return { magnitude: lo, newWinnerOptionId: resultAt(lo).ranking[0] }
}

function computeScorePivots(decision: Decision, originalWinners: string[]): ScorePivot[] {
  const pivots: ScorePivot[] = []

  for (const option of decision.options) {
    for (const criterion of decision.criteria) {
      const score = decision.scores.find(
        (s) => s.optionId === option.id && s.criterionId === criterion.id,
      )
      if (!score || score.value === null) continue
      const currentValue = score.value

      const increase = findScoreFlip(
        decision,
        option.id,
        criterion.id,
        currentValue,
        originalWinners,
        'increase',
        10 - currentValue,
      )
      const decrease = findScoreFlip(
        decision,
        option.id,
        criterion.id,
        currentValue,
        originalWinners,
        'decrease',
        currentValue - 1,
      )

      let chosen:
        | { magnitude: number; direction: 'increase' | 'decrease'; newWinnerOptionId: string }
        | null = null
      if (increase && decrease) {
        chosen =
          increase.magnitude <= decrease.magnitude
            ? { ...increase, direction: 'increase' }
            : { ...decrease, direction: 'decrease' }
      } else if (increase) {
        chosen = { ...increase, direction: 'increase' }
      } else if (decrease) {
        chosen = { ...decrease, direction: 'decrease' }
      }

      pivots.push({
        optionId: option.id,
        criterionId: criterion.id,
        currentValue,
        minScoreDeltaToFlip: chosen ? chosen.magnitude : null,
        direction: chosen ? chosen.direction : null,
        newWinnerOptionId: chosen ? chosen.newWinnerOptionId : null,
      })
    }
  }

  return pivots.sort((a, z) => {
    if (a.minScoreDeltaToFlip === null) return 1
    if (z.minScoreDeltaToFlip === null) return -1
    return a.minScoreDeltaToFlip - z.minScoreDeltaToFlip
  })
}

function classifyRobustness(
  weightPivots: WeightPivot[],
  scorePivots: ScorePivot[],
): { level: RobustnessLevel; basis: SensitivityResult['robustnessBasis'] } {
  let best: { kind: 'weight' | 'score'; fraction: number; raw: number } | null = null

  for (const p of weightPivots) {
    if (p.minWeightDeltaToFlip === null) continue
    const fraction = p.minWeightDeltaToFlip / 100
    if (!best || fraction < best.fraction) {
      best = { kind: 'weight', fraction, raw: p.minWeightDeltaToFlip }
    }
  }
  for (const p of scorePivots) {
    if (p.minScoreDeltaToFlip === null) continue
    const fraction = p.minScoreDeltaToFlip / 9
    if (!best || fraction < best.fraction) {
      best = { kind: 'score', fraction, raw: p.minScoreDeltaToFlip }
    }
  }

  if (!best) {
    return { level: 'robust', basis: { kind: 'none', minDelta: null } }
  }

  let level: RobustnessLevel
  if (best.fraction > ROBUSTNESS_THRESHOLDS.robust) level = 'robust'
  else if (best.fraction > ROBUSTNESS_THRESHOLDS.moderate) level = 'moderate'
  else level = 'fragile'

  return { level, basis: { kind: best.kind, minDelta: best.raw } }
}

export function computeSensitivityResult(decision: Decision): SensitivityResult {
  const base = {
    decisionId: decision.id,
    computedAt: new Date().toISOString(),
  }

  if (
    decision.options.length < MIN_OPTIONS_FOR_SENSITIVITY ||
    decision.criteria.length < MIN_CRITERIA_FOR_SENSITIVITY
  ) {
    return {
      ...base,
      weightPivots: [],
      scorePivots: [],
      overallRobustness: 'indeterminate',
      robustnessBasis: { kind: 'none', minDelta: null },
      applicable: false,
      inapplicableReason:
        'Sensitivity analysis requires at least 2 options and 2 criteria to be meaningful.',
    }
  }

  const originalWinners = computeDecisionResult(decision).winnerOptionIds
  const weightPivots = computeWeightPivots(decision, originalWinners)
  const scorePivots = computeScorePivots(decision, originalWinners)
  const { level, basis } = classifyRobustness(weightPivots, scorePivots)

  return {
    ...base,
    weightPivots,
    scorePivots,
    overallRobustness: level,
    robustnessBasis: basis,
    applicable: true,
  }
}
