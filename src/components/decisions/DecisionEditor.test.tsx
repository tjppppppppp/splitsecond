import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DecisionEditor } from './DecisionEditor'
import type { Decision } from '../../lib/types'

function baseDecision(partial: Partial<Decision>): Decision {
  return {
    id: 'd1',
    schemaVersion: 1,
    title: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    options: [],
    criteria: [],
    scores: [],
    ...partial,
  }
}

const noop = vi.fn()

describe('DecisionEditor weight gating', () => {
  it('hides the score grid and shows a banner when weights do not sum to 100', () => {
    const decision = baseDecision({
      options: [{ id: 'a', name: 'A' }],
      criteria: [{ id: 'c1', name: 'Cost', weight: 50 }],
    })
    render(
      <DecisionEditor
        decision={decision}
        onUpdateDecision={noop}
        onAddOption={noop}
        onRemoveOption={noop}
        onAddCriterion={noop}
        onUpdateCriterion={noop}
        onRemoveCriterion={noop}
        onScoreChange={noop}
      />,
    )
    expect(screen.queryByTestId('score-grid')).toBeNull()
    expect(screen.getByText(/before scoring/i)).toBeInTheDocument()
  })

  it('shows the score grid once weights sum to exactly 100 and an option exists', () => {
    const decision = baseDecision({
      options: [{ id: 'a', name: 'A' }],
      criteria: [{ id: 'c1', name: 'Cost', weight: 100 }],
    })
    render(
      <DecisionEditor
        decision={decision}
        onUpdateDecision={noop}
        onAddOption={noop}
        onRemoveOption={noop}
        onAddCriterion={noop}
        onUpdateCriterion={noop}
        onRemoveCriterion={noop}
        onScoreChange={noop}
      />,
    )
    expect(screen.getByTestId('score-grid')).toBeInTheDocument()
  })
})
