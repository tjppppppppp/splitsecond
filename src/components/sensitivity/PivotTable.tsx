import type { ScorePivot } from '../../lib/types'

interface PivotTableProps {
  pivots: ScorePivot[]
  optionNames: Record<string, string>
  criterionNames: Record<string, string>
  limit?: number
}

export function PivotTable({ pivots, optionNames, criterionNames, limit = 8 }: PivotTableProps) {
  const withFlips = pivots.filter((p) => p.minScoreDeltaToFlip !== null).slice(0, limit)

  if (withFlips.length === 0) {
    return <p>No single score change flips the winner within the valid 1-10 range.</p>
  }

  return (
    <table className="pivot-table">
      <thead>
        <tr>
          <th>Option</th>
          <th>Criterion</th>
          <th>Current score</th>
          <th>Flips if changed by</th>
          <th>New winner</th>
        </tr>
      </thead>
      <tbody>
        {withFlips.map((p) => (
          <tr key={`${p.optionId}-${p.criterionId}`}>
            <td>{optionNames[p.optionId] ?? p.optionId}</td>
            <td>{criterionNames[p.criterionId] ?? p.criterionId}</td>
            <td>{p.currentValue}</td>
            <td>
              {p.direction === 'increase' ? '+' : '−'}
              {p.minScoreDeltaToFlip}
            </td>
            <td>{optionNames[p.newWinnerOptionId ?? ''] ?? p.newWinnerOptionId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
