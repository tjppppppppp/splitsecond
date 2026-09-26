// Weight-sum validation. Integer percentages only -- no float/epsilon
// tolerance, so `sum === 100` is an exact, trivially-testable check.

import type { Criterion } from './types'

export interface WeightValidationResult {
  valid: boolean
  sum: number
}

export function validateWeights(criteria: Criterion[]): WeightValidationResult {
  const sum = criteria.reduce((total, c) => total + c.weight, 0)
  return { valid: sum === 100, sum }
}
