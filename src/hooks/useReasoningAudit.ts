import { useCallback, useState } from 'react'
import { computeReasoningAudit } from '../lib/audit/auditEngine'
import type { AuditResult, Decision, DecisionResult, SensitivityResult } from '../lib/types'

type AuditState =
  | { status: 'idle' }
  | { status: 'error' }
  | { status: 'success'; result: AuditResult }

/**
 * Runs the local, deterministic reasoning-audit engine. No network call, no
 * secrets, no external service -- this always succeeds unless the engine
 * itself throws, which would be a bug in computeReasoningAudit, not an
 * environmental failure. Kept as a manual "Run analysis" trigger (rather
 * than auto-running on every keystroke) so recomputation doesn't surprise
 * someone mid-edit, even though it's now instant.
 */
export function useReasoningAudit() {
  const [state, setState] = useState<AuditState>({ status: 'idle' })

  const runAudit = useCallback((decision: Decision, result: DecisionResult, sensitivity: SensitivityResult) => {
    try {
      const audit = computeReasoningAudit(decision, result, sensitivity)
      setState({ status: 'success', result: audit })
    } catch {
      setState({ status: 'error' })
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, runAudit, reset }
}
