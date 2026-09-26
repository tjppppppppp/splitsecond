// Deterministic, local, rule-based reasoning audit. No network calls, no
// secrets, no external API of any kind. This replaces what used to be a
// paid-AI-API-backed "Challenge My Decision" feature -- see README for why.
//
// Same boundary rule as scoring.ts/sensitivity.ts: this file may only *read*
// Decision/DecisionResult/SensitivityResult, never produce or influence a
// score/weight/ranking. No React or DOM imports allowed here either.

import type {
  AuditResult,
  Decision,
  DecisionResult,
  ScorePivot,
  SensitivityResult,
  WeightPivot,
} from '../types'

export const AUDIT_THRESHOLDS = {
  /** A score with reasoning shorter than this many words is "very brief". */
  MIN_REASONING_WORDS: 4,
  /** Used by the score-spread check: reasoning shorter than this counts as thin. */
  THIN_REASONING_WORDS: 8,
  /** Min (max - min) raw score spread on one criterion to flag as "large". */
  LARGE_SCORE_SPREAD: 5,
  /** A single criterion's weight at or above this percent is flagged as dominant. */
  EXTREME_WEIGHT_PERCENT: 50,
  /** A weight-flip distance at or below this many points is "disproportionate". */
  DISPROPORTIONATE_WEIGHT_DELTA: 5,
} as const

const MIN_CRITERIA_BEFORE_FLAGGING_FEW = 3
const WHAT_WOULD_CHANGE_TOP_N = 3

const HEDGE_PHRASES = [
  'not sure',
  'i guess',
  'i think',
  'no idea',
  'hard to say',
  'maybe',
  'probably',
  'unclear',
  'unsure',
  'possibly',
]

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function optionName(decision: Decision, optionId: string): string {
  return decision.options.find((o) => o.id === optionId)?.name ?? optionId
}

function criterionName(decision: Decision, criterionId: string): string {
  return decision.criteria.find((c) => c.id === criterionId)?.name ?? criterionId
}

function normalizeWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function namesOverlap(a: string, b: string): boolean {
  const wordsA = normalizeWords(a)
  const wordsB = normalizeWords(b)
  if (wordsA.length === 0 || wordsB.length === 0) return false
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA]
  if (shorter.join(' ') === longer.join(' ')) return true
  const longerStr = ` ${longer.join(' ')} `
  const shorterStr = ` ${shorter.join(' ')} `
  return longerStr.includes(shorterStr)
}

// ---- 1. Unsupported / weakly-justified scores ----

function checkUnsupportedScores(decision: Decision): AuditResult['unsupportedAssumptions'] {
  const flags: AuditResult['unsupportedAssumptions'] = []
  for (const score of decision.scores) {
    if (score.value === null) continue
    const words = wordCount(score.reasoning)
    if (words >= AUDIT_THRESHOLDS.MIN_REASONING_WORDS) continue
    const option = optionName(decision, score.optionId)
    const criterion = criterionName(decision, score.criterionId)
    flags.push({
      location: { optionId: score.optionId, criterionId: score.criterionId },
      assumption: `A score of ${score.value} for '${option}' on '${criterion}' is asserted here.`,
      whyUnsupported:
        words === 0
          ? 'No reasoning was given for this score.'
          : `Reasoning is very brief for a score of ${score.value}.`,
    })
  }
  return flags
}

// ---- 2. Large score spread with weak justification on both ends ----

function checkLargeSpreads(decision: Decision): AuditResult['uncertaintyFlags'] {
  const flags: AuditResult['uncertaintyFlags'] = []
  for (const criterion of decision.criteria) {
    const cells = decision.scores.filter((s) => s.criterionId === criterion.id && s.value !== null) as {
      optionId: string
      criterionId: string
      value: number
      reasoning: string
    }[]
    if (cells.length < 2) continue

    let maxCell = cells[0]
    let minCell = cells[0]
    for (const cell of cells) {
      if (cell.value > maxCell.value) maxCell = cell
      if (cell.value < minCell.value) minCell = cell
    }
    const spread = maxCell.value - minCell.value
    if (spread < AUDIT_THRESHOLDS.LARGE_SCORE_SPREAD) continue
    if (
      wordCount(maxCell.reasoning) >= AUDIT_THRESHOLDS.THIN_REASONING_WORDS ||
      wordCount(minCell.reasoning) >= AUDIT_THRESHOLDS.THIN_REASONING_WORDS
    ) {
      continue
    }

    flags.push({
      // Both ends of the spread are relevant, but the type only carries one
      // location -- anchor on the higher-scoring cell and name both options
      // in the text.
      location: { optionId: maxCell.optionId, criterionId: criterion.id },
      concern: `'${criterion.name}' scores range from ${minCell.value} to ${maxCell.value} across options ('${optionName(decision, minCell.optionId)}' vs '${optionName(decision, maxCell.optionId)}'), but the reasoning behind that gap is thin on both ends.`,
    })
  }
  return flags
}

// ---- 3. Duplicated / overlapping criteria ----

function checkDoubleCounted(decision: Decision): AuditResult['doubleCountedFactors'] {
  const flags: AuditResult['doubleCountedFactors'] = []
  const criteria = decision.criteria

  for (let i = 0; i < criteria.length; i++) {
    for (let j = i + 1; j < criteria.length; j++) {
      const c1 = criteria[i]
      const c2 = criteria[j]

      const overlapOptionIds = decision.options
        .map((o) => o.id)
        .filter((optionId) => {
          const s1 = decision.scores.find((s) => s.optionId === optionId && s.criterionId === c1.id)
          const s2 = decision.scores.find((s) => s.optionId === optionId && s.criterionId === c2.id)
          return s1?.value !== null && s1?.value !== undefined && s2?.value !== null && s2?.value !== undefined
        })
        .sort()

      if (overlapOptionIds.length >= 2) {
        const vec1 = overlapOptionIds.map(
          (optionId) => decision.scores.find((s) => s.optionId === optionId && s.criterionId === c1.id)!.value,
        )
        const vec2 = overlapOptionIds.map(
          (optionId) => decision.scores.find((s) => s.optionId === optionId && s.criterionId === c2.id)!.value,
        )
        if (vec1.every((v, idx) => v === vec2[idx])) {
          flags.push({
            criterionIds: [c1.id, c2.id],
            explanation: `'${c1.name}' and '${c2.name}' score every option identically -- they may be measuring the same underlying factor twice.`,
          })
        }
      }

      if (namesOverlap(c1.name, c2.name)) {
        flags.push({
          criterionIds: [c1.id, c2.id],
          explanation: `'${c1.name}' and '${c2.name}' have very similar names and may overlap.`,
        })
      }
    }
  }
  return flags
}

// ---- 4 & 5. Bias flags: extreme weight, and outcome hinging on one criterion ----

function checkBiasFlags(decision: Decision, sensitivity: SensitivityResult): AuditResult['biasFlags'] {
  const flags: AuditResult['biasFlags'] = []

  for (const criterion of decision.criteria) {
    if (criterion.weight >= AUDIT_THRESHOLDS.EXTREME_WEIGHT_PERCENT) {
      flags.push({
        biasType: 'Single-factor dominance',
        location: { criterionId: criterion.id },
        explanation: `'${criterion.name}' carries ${criterion.weight}% of the total weight -- a single factor this large can dominate the outcome regardless of other criteria.`,
      })
    }
  }

  if (sensitivity.applicable) {
    for (const pivot of sensitivity.weightPivots) {
      if (pivot.minWeightDeltaToFlip !== null && pivot.minWeightDeltaToFlip <= AUDIT_THRESHOLDS.DISPROPORTIONATE_WEIGHT_DELTA) {
        flags.push({
          biasType: 'Outcome hinges on one criterion',
          location: { criterionId: pivot.criterionId },
          explanation: `Shifting '${criterionName(decision, pivot.criterionId)}' by just ${pivot.minWeightDeltaToFlip} weight point(s) would change the winner.`,
        })
      }
    }
  }

  return flags
}

// ---- 6. Uncertainty / hedging language ----

function checkHedgingLanguage(decision: Decision): AuditResult['uncertaintyFlags'] {
  const flags: AuditResult['uncertaintyFlags'] = []
  for (const score of decision.scores) {
    if (score.value === null) continue
    if (wordCount(score.reasoning) === 0) continue // already covered by unsupportedAssumptions
    const lower = score.reasoning.toLowerCase()
    const matched = HEDGE_PHRASES.find((phrase) => lower.includes(phrase))
    if (matched) {
      flags.push({
        location: { optionId: score.optionId, criterionId: score.criterionId },
        concern: `Reasoning for '${optionName(decision, score.optionId)}' on '${criterionName(decision, score.criterionId)}' hedges with "${matched}".`,
      })
    }
  }
  return flags
}

// ---- 7. What would change your mind ----

function checkWhatWouldChangeYourMind(
  decision: Decision,
  sensitivity: SensitivityResult,
): AuditResult['whatWouldChangeYourMind'] {
  if (!sensitivity.applicable) {
    return [
      {
        statement: "No small change in any weight or score would flip this decision's outcome -- it appears robust.",
        relatedCriterionIds: [],
      },
    ]
  }

  type Candidate = { delta: number; statement: string; relatedCriterionIds: string[] }
  const candidates: Candidate[] = []

  for (const pivot of sensitivity.weightPivots as WeightPivot[]) {
    if (pivot.minWeightDeltaToFlip === null || !pivot.newWinnerOptionId) continue
    candidates.push({
      delta: pivot.minWeightDeltaToFlip,
      statement: `If '${criterionName(decision, pivot.criterionId)}' weight moved by ${pivot.minWeightDeltaToFlip} point(s), the winner would change to '${optionName(decision, pivot.newWinnerOptionId)}'.`,
      relatedCriterionIds: [pivot.criterionId],
    })
  }

  for (const pivot of sensitivity.scorePivots as ScorePivot[]) {
    if (pivot.minScoreDeltaToFlip === null || !pivot.newWinnerOptionId) continue
    candidates.push({
      delta: pivot.minScoreDeltaToFlip,
      statement: `If ${optionName(decision, pivot.optionId)}'s score on '${criterionName(decision, pivot.criterionId)}' changed by ${pivot.minScoreDeltaToFlip}, the winner would change to '${optionName(decision, pivot.newWinnerOptionId)}'.`,
      relatedCriterionIds: [pivot.criterionId],
    })
  }

  if (candidates.length === 0) {
    return [
      {
        statement: "No small change in any weight or score would flip this decision's outcome -- it appears robust.",
        relatedCriterionIds: [],
      },
    ]
  }

  return candidates
    .sort((a, z) => a.delta - z.delta)
    .slice(0, WHAT_WOULD_CHANGE_TOP_N)
    .map(({ statement, relatedCriterionIds }) => ({ statement, relatedCriterionIds }))
}

// ---- 8. Missing criteria ----

function checkMissingCriteria(decision: Decision): AuditResult['missingCriteria'] {
  if (decision.criteria.length >= MIN_CRITERIA_BEFORE_FLAGGING_FEW) return []
  return [
    {
      suggestion: 'Consider whether you’re missing an important dimension.',
      rationale: `Only ${decision.criteria.length} criteria are being weighed -- decisions with very few criteria sometimes overlook a relevant factor.`,
    },
  ]
}

// ---- 9. Overall summary ----

function buildSummary(
  decision: Decision,
  result: DecisionResult,
  sensitivity: SensitivityResult,
  counts: { missingCriteria: number; unsupportedAssumptions: number; doubleCountedFactors: number; uncertaintyFlags: number; biasFlags: number },
): string {
  const total =
    counts.missingCriteria + counts.unsupportedAssumptions + counts.doubleCountedFactors + counts.uncertaintyFlags + counts.biasFlags
  const categoriesHit = Object.values(counts).filter((n) => n > 0).length

  let robustnessClause: string
  if (!sensitivity.applicable) {
    robustnessClause = 'Sensitivity analysis was not applicable to this decision.'
  } else if (sensitivity.robustnessBasis.kind === 'none') {
    robustnessClause = 'This decision is robust to small changes.'
  } else if (sensitivity.robustnessBasis.kind === 'weight') {
    const pivot = sensitivity.weightPivots[0]
    robustnessClause = pivot
      ? `This decision is sensitive to small changes in '${criterionName(decision, pivot.criterionId)}' weight.`
      : 'This decision is sensitive to small changes in weights.'
  } else {
    robustnessClause = 'This decision is sensitive to small changes in individual scores.'
  }

  const tieClause = result.winnerOptionIds.length > 1 ? ' Options are currently tied for the top result.' : ''

  return `Found ${total} reasoning note(s) across ${categoriesHit} categor${categoriesHit === 1 ? 'y' : 'ies'}. ${robustnessClause}${tieClause}`
}

export function computeReasoningAudit(
  decision: Decision,
  result: DecisionResult,
  sensitivity: SensitivityResult,
): AuditResult {
  const missingCriteria = checkMissingCriteria(decision)
  const unsupportedAssumptions = checkUnsupportedScores(decision)
  const doubleCountedFactors = checkDoubleCounted(decision)
  const uncertaintyFlags = [...checkLargeSpreads(decision), ...checkHedgingLanguage(decision)]
  const biasFlags = checkBiasFlags(decision, sensitivity)
  const whatWouldChangeYourMind = checkWhatWouldChangeYourMind(decision, sensitivity)

  const overallAuditSummary = buildSummary(decision, result, sensitivity, {
    missingCriteria: missingCriteria.length,
    unsupportedAssumptions: unsupportedAssumptions.length,
    doubleCountedFactors: doubleCountedFactors.length,
    uncertaintyFlags: uncertaintyFlags.length,
    biasFlags: biasFlags.length,
  })

  return {
    schemaVersion: 1,
    missingCriteria,
    unsupportedAssumptions,
    doubleCountedFactors,
    uncertaintyFlags,
    biasFlags,
    whatWouldChangeYourMind,
    overallAuditSummary,
  }
}
