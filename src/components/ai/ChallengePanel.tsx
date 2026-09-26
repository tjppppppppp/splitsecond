import { useMemo } from 'react'
import { ChallengeResultView } from './ChallengeResultView'
import { StalenessWarning } from './StalenessWarning'
import { Button } from '../shared/Button'
import { EmptyState } from '../shared/EmptyState'
import { buildChallengeContext } from '../../lib/ai/buildChallengeContext'
import { hashDecisionContent, isChallengeStale } from '../../lib/ai/stalenessCheck'
import { computeDecisionResult } from '../../lib/scoring'
import { computeSensitivityResult } from '../../lib/sensitivity'
import { useChallengeClient } from '../../hooks/useChallengeClient'
import type { Decision } from '../../lib/types'

const REASON_MESSAGES: Record<string, string> = {
  server_misconfigured: 'AI analysis is not configured for this deployment yet.',
  ai_unavailable: 'The AI service is temporarily unavailable.',
  invalid_ai_response: "The AI's response could not be understood.",
  network_error: 'Could not reach the server.',
}

interface ChallengePanelProps {
  decision: Decision
  onChallengeStored: (payload: Decision['lastChallenge']) => void
}

export function ChallengePanel({ decision, onChallengeStored }: ChallengePanelProps) {
  const { state, runChallenge } = useChallengeClient()

  const currentHash = useMemo(() => hashDecisionContent(decision), [decision])
  const stale = decision.lastChallenge ? isChallengeStale(decision, decision.lastChallenge.decisionSnapshotHash) : false

  async function handleRun() {
    const result = computeDecisionResult(decision)
    const sensitivity = computeSensitivityResult(decision)
    const context = buildChallengeContext(decision, result, sensitivity)
    await runChallenge(context)
  }

  // Persist a successful run onto the decision so it survives a reload.
  if (state.status === 'success') {
    const alreadyStored = decision.lastChallenge?.result === state.result
    if (!alreadyStored) {
      onChallengeStored({ result: state.result, decisionSnapshotHash: currentHash, ranAt: new Date().toISOString() })
    }
  }

  const displayResult = state.status === 'success' ? state.result : decision.lastChallenge?.result

  if (decision.options.length === 0 || decision.criteria.length === 0) {
    return (
      <EmptyState
        title="Add options and criteria first"
        description="Challenge My Decision needs at least the shape of a decision to critique."
      />
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Challenge My Decision</h3>
        <Button variant="primary" onClick={handleRun} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Analyzing...' : displayResult ? 'Re-run' : 'Run analysis'}
        </Button>
      </div>

      {displayResult && <StalenessWarning stale={stale} onRerun={handleRun} />}

      {state.status === 'error' && (
        <p className="banner banner-warning">
          {REASON_MESSAGES[state.reason] ?? 'Something went wrong.'}
          {state.retryable && ' You can try again.'}
        </p>
      )}

      {!displayResult && state.status !== 'loading' && state.status !== 'error' && (
        <EmptyState
          title="No analysis yet"
          description="Run an analysis to get feedback on missing criteria, assumptions, and reasoning quality. This never changes your score."
        />
      )}

      {displayResult && <ChallengeResultView result={displayResult} decision={decision} />}
    </div>
  )
}
