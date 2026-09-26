// Core data model for SplitSecond.
//
// Boundary rule: this file, scoring.ts, validation.ts, and sensitivity.ts must
// never import from ./ai/* or React. The ai/* layer may import types from
// here (read-only consumption of DecisionResult/SensitivityResult) but the
// reverse dependency is forbidden.

export interface Criterion {
  id: string
  name: string
  description?: string
  /** Integer 0-100. All criteria weights on a decision must sum to exactly 100. */
  weight: number
}

export interface Option {
  id: string
  name: string
  description?: string
}

export interface Score {
  optionId: string
  criterionId: string
  /** 1-10, or null when not yet scored. */
  value: number | null
  reasoning: string
}

export interface Decision {
  id: string
  schemaVersion: 1
  title: string
  description?: string
  createdAt: string
  updatedAt: string
  options: Option[]
  criteria: Criterion[]
  scores: Score[]
  lastChallenge?: {
    result: ChallengeResult
    decisionSnapshotHash: string
    ranAt: string
  }
}

// ---- Deterministic scoring output ----

export interface OptionScoreBreakdown {
  optionId: string
  weightedTotal: number
  perCriterion: {
    criterionId: string
    rawScore: number | null
    weight: number
    contribution: number
  }[]
  missingCells: number
}

export interface DecisionResult {
  decisionId: string
  computedAt: string
  breakdowns: OptionScoreBreakdown[]
  /** optionIds sorted best-to-worst by weightedTotal. */
  ranking: string[]
  /** Length > 1 only in an exact tie at the top. */
  winnerOptionIds: string[]
  isComplete: boolean
}

// ---- Sensitivity analysis output ----

export type RobustnessLevel = 'robust' | 'moderate' | 'fragile' | 'indeterminate'

export interface WeightPivot {
  criterionId: string
  currentWeight: number
  minWeightDeltaToFlip: number | null
  direction: 'increase' | 'decrease' | null
  newWinnerOptionId: string | null
}

export interface ScorePivot {
  optionId: string
  criterionId: string
  currentValue: number | null
  minScoreDeltaToFlip: number | null
  direction: 'increase' | 'decrease' | null
  newWinnerOptionId: string | null
}

export interface SensitivityResult {
  decisionId: string
  computedAt: string
  weightPivots: WeightPivot[]
  scorePivots: ScorePivot[]
  overallRobustness: RobustnessLevel
  robustnessBasis: {
    kind: 'weight' | 'score' | 'none'
    minDelta: number | null
  }
  applicable: boolean
  inapplicableReason?: string
}

// ---- AI layer ----
//
// Every field below is a string, string-enum, or array of those. There is no
// number field anywhere in this type, and no field named/shaped like
// score/weight/ranking/winner/confidence. This is deliberate, structural
// enforcement of "AI never touches the deterministic score" -- see
// src/lib/ai/aiTypes.ts for the zod schema that enforces this at runtime.

export interface ChallengeResult {
  schemaVersion: 1
  missingCriteria: { suggestion: string; rationale: string }[]
  unsupportedAssumptions: {
    location: { optionId: string; criterionId: string }
    assumption: string
    whyUnsupported: string
  }[]
  doubleCountedFactors: { criterionIds: string[]; explanation: string }[]
  uncertaintyFlags: {
    location: { optionId: string; criterionId: string }
    concern: string
  }[]
  biasFlags: {
    biasType: string
    location?: { optionId: string; criterionId: string }
    explanation: string
  }[]
  whatWouldChangeYourMind: { statement: string; relatedCriterionIds: string[] }[]
  overallReasoningQualityNote: string
}
