import type { Criterion, Option, Score } from '../../lib/types'

interface ScoreGridProps {
  options: Option[]
  criteria: Criterion[]
  scores: Score[]
  onChange: (optionId: string, criterionId: string, patch: Partial<Score>) => void
}

export function ScoreGrid({ options, criteria, scores, onChange }: ScoreGridProps) {
  function findScore(optionId: string, criterionId: string): Score | undefined {
    return scores.find((s) => s.optionId === optionId && s.criterionId === criterionId)
  }

  return (
    <div>
      <h3>Scores</h3>
      <table className="score-grid" data-testid="score-grid">
        <thead>
          <tr>
            <th>Option</th>
            {criteria.map((c) => (
              <th key={c.id}>
                {c.name} ({c.weight}%)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.id}>
              <th scope="row">{option.name}</th>
              {criteria.map((criterion) => {
                const existing = findScore(option.id, criterion.id)
                return (
                  <td className="score-cell" key={criterion.id}>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      aria-label={`${option.name} score for ${criterion.name}`}
                      value={existing?.value ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        const value = raw === '' ? null : Math.min(10, Math.max(1, Number(raw)))
                        onChange(option.id, criterion.id, { value })
                      }}
                    />
                    <textarea
                      placeholder="Reasoning / evidence..."
                      aria-label={`${option.name} reasoning for ${criterion.name}`}
                      value={existing?.reasoning ?? ''}
                      onChange={(e) => onChange(option.id, criterion.id, { reasoning: e.target.value })}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
