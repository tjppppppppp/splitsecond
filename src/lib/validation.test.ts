import { describe, expect, it } from 'vitest'
import { validateWeights } from './validation'
import type { Criterion } from './types'

function crit(weight: number, id = 'c'): Criterion {
  return { id, name: id, weight }
}

describe('validateWeights', () => {
  it('passes when weights sum to exactly 100', () => {
    expect(validateWeights([crit(50, 'a'), crit(50, 'b')])).toEqual({ valid: true, sum: 100 })
  })

  it('passes for a single criterion at 100', () => {
    expect(validateWeights([crit(100, 'a')])).toEqual({ valid: true, sum: 100 })
  })

  it('fails at 99', () => {
    expect(validateWeights([crit(50, 'a'), crit(49, 'b')])).toEqual({ valid: false, sum: 99 })
  })

  it('fails at 101', () => {
    expect(validateWeights([crit(50, 'a'), crit(51, 'b')])).toEqual({ valid: false, sum: 101 })
  })

  it('fails at 0 (empty criteria list)', () => {
    expect(validateWeights([])).toEqual({ valid: false, sum: 0 })
  })

  it('sums three-way integer splits correctly', () => {
    expect(validateWeights([crit(33, 'a'), crit(33, 'b'), crit(34, 'c')])).toEqual({
      valid: true,
      sum: 100,
    })
  })
})
