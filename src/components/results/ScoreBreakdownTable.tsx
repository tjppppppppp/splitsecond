import type { Decision, DecisionResult } from '../../lib/types'

interface ScoreBreakdownTableProps {
  decision: Decision
  result: DecisionResult
}

export function ScoreBreakdownTable({ decision, result }: ScoreBreakdownTableProps) {
  function optionName(id: string): string {
    return decision.options.find((o) => o.id === id)?.name ?? id
  }

  return (
    <table className="results-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Option</th>
          <th>Weighted score</th>
          <th>Missing cells</th>
        </tr>
      </thead>
      <tbody>
        {result.ranking.map((optionId, index) => {
          const breakdown = result.breakdowns.find((b) => b.optionId === optionId)!
          const isWinner = result.winnerOptionIds.includes(optionId)
          return (
            <tr key={optionId} className={isWinner ? 'is-winner' : ''}>
              <td>{index + 1}</td>
              <td>
                {optionName(optionId)}
                {isWinner && ' ★'}
              </td>
              <td>{breakdown.weightedTotal.toFixed(2)} / 10</td>
              <td>{breakdown.missingCells}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
