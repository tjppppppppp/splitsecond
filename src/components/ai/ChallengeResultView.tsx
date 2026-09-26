import type { ChallengeResult, Decision } from '../../lib/types'

interface ChallengeResultViewProps {
  result: ChallengeResult
  decision: Decision
}

function locationLabel(decision: Decision, loc?: { optionId: string; criterionId: string }): string | null {
  if (!loc) return null
  const option = decision.options.find((o) => o.id === loc.optionId)?.name ?? loc.optionId
  const criterion = decision.criteria.find((c) => c.id === loc.criterionId)?.name ?? loc.criterionId
  return `${option} × ${criterion}`
}

export function ChallengeResultView({ result, decision }: ChallengeResultViewProps) {
  return (
    <div>
      <p>{result.overallReasoningQualityNote}</p>

      {result.missingCriteria.length > 0 && (
        <section className="challenge-section">
          <h4>Missing criteria</h4>
          <ul className="challenge-list">
            {result.missingCriteria.map((m, i) => (
              <li key={i}>
                <strong>{m.suggestion}</strong> &mdash; {m.rationale}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.unsupportedAssumptions.length > 0 && (
        <section className="challenge-section">
          <h4>Unsupported assumptions</h4>
          <ul className="challenge-list">
            {result.unsupportedAssumptions.map((a, i) => (
              <li key={i}>
                {locationLabel(decision, a.location) && (
                  <em>{locationLabel(decision, a.location)}: </em>
                )}
                {a.assumption} &mdash; {a.whyUnsupported}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.doubleCountedFactors.length > 0 && (
        <section className="challenge-section">
          <h4>Possibly double-counted factors</h4>
          <ul className="challenge-list">
            {result.doubleCountedFactors.map((d, i) => (
              <li key={i}>
                {d.criterionIds
                  .map((id) => decision.criteria.find((c) => c.id === id)?.name ?? id)
                  .join(' & ')}
                : {d.explanation}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.uncertaintyFlags.length > 0 && (
        <section className="challenge-section">
          <h4>Uncertainty</h4>
          <ul className="challenge-list">
            {result.uncertaintyFlags.map((u, i) => (
              <li key={i}>
                {locationLabel(decision, u.location) && (
                  <em>{locationLabel(decision, u.location)}: </em>
                )}
                {u.concern}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.biasFlags.length > 0 && (
        <section className="challenge-section">
          <h4>Possible reasoning biases</h4>
          <ul className="challenge-list">
            {result.biasFlags.map((b, i) => (
              <li key={i}>
                <strong>{b.biasType}</strong>
                {locationLabel(decision, b.location) && ` (${locationLabel(decision, b.location)})`}
                : {b.explanation}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.whatWouldChangeYourMind.length > 0 && (
        <section className="challenge-section">
          <h4>What would change your mind?</h4>
          <ul className="challenge-list">
            {result.whatWouldChangeYourMind.map((w, i) => (
              <li key={i}>{w.statement}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
