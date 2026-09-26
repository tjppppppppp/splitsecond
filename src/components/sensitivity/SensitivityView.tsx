import { useMemo } from 'react'
import { PivotTable } from './PivotTable'
import { RobustnessBadge } from './RobustnessBadge'
import { TornadoChart } from './TornadoChart'
import { EmptyState } from '../shared/EmptyState'
import { computeSensitivityResult } from '../../lib/sensitivity'
import type { Decision } from '../../lib/types'

interface SensitivityViewProps {
  decision: Decision
}

export function SensitivityView({ decision }: SensitivityViewProps) {
  const result = useMemo(() => computeSensitivityResult(decision), [decision])

  const criterionNames = Object.fromEntries(decision.criteria.map((c) => [c.id, c.name]))
  const optionNames = Object.fromEntries(decision.options.map((o) => [o.id, o.name]))

  if (!result.applicable) {
    return <EmptyState title="Sensitivity analysis not available" description={result.inapplicableReason} />
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>How robust is this result?</h3>
        <RobustnessBadge level={result.overallRobustness} />
      </div>

      <h4>Weight sensitivity</h4>
      <p>How much would each criterion's weight need to change to flip the winner?</p>
      <TornadoChart pivots={result.weightPivots} criterionNames={criterionNames} />

      <h4>Most fragile score pivots</h4>
      <p>The smallest single-score changes that would flip the winner.</p>
      <PivotTable pivots={result.scorePivots} optionNames={optionNames} criterionNames={criterionNames} />
    </div>
  )
}
