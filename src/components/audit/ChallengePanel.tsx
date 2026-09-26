import { useMemo } from 'react'
import { AuditResultView } from './AuditResultView'
import { StalenessWarning } from './StalenessWarning'
import { Button } from '../shared/Button'
import { EmptyState } from '../shared/EmptyState'
import { hashDecisionContent, isAuditStale } from '../../lib/audit/stalenessCheck'
import { computeDecisionResult } from '../../lib/scoring'
import { computeSensitivityResult } from '../../lib/sensitivity'
import { useReasoningAudit } from '../../hooks/useReasoningAudit'
import type { Decision } from '../../lib/types'

interface ChallengePanelProps {
  decision: Decision
  onAuditStored: (payload: Decision['lastAudit']) => void
}

export function ChallengePanel({ decision, onAuditStored }: ChallengePanelProps) {
  const { state, runAudit } = useReasoningAudit()

  const currentHash = useMemo(() => hashDecisionContent(decision), [decision])
  const stale = decision.lastAudit ? isAuditStale(decision, decision.lastAudit.decisionSnapshotHash) : false

  function handleRun() {
    const result = computeDecisionResult(decision)
    const sensitivity = computeSensitivityResult(decision)
    runAudit(decision, result, sensitivity)
  }

  // Persist a successful run onto the decision so it survives a reload.
  if (state.status === 'success') {
    const alreadyStored = decision.lastAudit?.result === state.result
    if (!alreadyStored) {
      onAuditStored({ result: state.result, decisionSnapshotHash: currentHash, ranAt: new Date().toISOString() })
    }
  }

  const displayResult = state.status === 'success' ? state.result : decision.lastAudit?.result

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
        <div>
          <h3 style={{ margin: 0 }}>Challenge My Decision</h3>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.85em' }}>
            Automated reasoning checks &mdash; runs locally, no network calls.
          </p>
        </div>
        <Button variant="primary" onClick={handleRun}>
          {displayResult ? 'Re-run' : 'Run analysis'}
        </Button>
      </div>

      {displayResult && <StalenessWarning stale={stale} onRerun={handleRun} />}

      {state.status === 'error' && (
        <p className="banner banner-warning">
          The reasoning audit could not run due to an unexpected error. You can try again.
        </p>
      )}

      {!displayResult && state.status !== 'error' && (
        <EmptyState
          title="No analysis yet"
          description="Run an analysis to get feedback on missing criteria, assumptions, and reasoning quality. This never changes your score."
        />
      )}

      {displayResult && <AuditResultView result={displayResult} decision={decision} />}
    </div>
  )
}
