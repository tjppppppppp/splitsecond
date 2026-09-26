import { useMemo, useState } from 'react'
import { ScoreBreakdownTable } from './ScoreBreakdownTable'
import { Button } from '../shared/Button'
import { EmptyState } from '../shared/EmptyState'
import { computeDecisionResult } from '../../lib/scoring'
import type { Decision } from '../../lib/types'

interface ResultsViewProps {
  decision: Decision
}

export function ResultsView({ decision }: ResultsViewProps) {
  const [previewAnyway, setPreviewAnyway] = useState(false)
  const result = useMemo(() => computeDecisionResult(decision), [decision])

  if (decision.options.length === 0 || decision.criteria.length === 0) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Add options and criteria, then score them, to see a result."
      />
    )
  }

  if (!result.isComplete && !previewAnyway) {
    const missingCount = result.breakdowns.reduce((s, b) => s + b.missingCells, 0)
    return (
      <div className="card">
        <p className="banner banner-warning">
          {missingCount} score cell{missingCount === 1 ? '' : 's'} still missing. Results are
          hidden until every option is scored against every criterion, so options stay
          apples-to-apples comparable.
        </p>
        <Button variant="secondary" onClick={() => setPreviewAnyway(true)}>
          Preview partial results anyway
        </Button>
      </div>
    )
  }

  return (
    <div className="card">
      {!result.isComplete && (
        <p className="banner banner-warning">
          This result is partial: some cells are still unscored and excluded from each option's
          total (not renormalized), so it is not a fair comparison yet.
        </p>
      )}
      {result.winnerOptionIds.length > 1 && (
        <p className="banner banner-info">
          It's a tie between{' '}
          {result.winnerOptionIds
            .map((id) => decision.options.find((o) => o.id === id)?.name ?? id)
            .join(' and ')}
          .
        </p>
      )}
      <ScoreBreakdownTable decision={decision} result={result} />
    </div>
  )
}
