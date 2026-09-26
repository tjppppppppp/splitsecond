import { useCallback, useState } from 'react'
import { parseChallengeResult } from '../lib/ai/aiTypes'
import type { ChallengeRequestContext } from '../lib/ai/buildChallengeContext'
import type { ChallengeResult } from '../lib/types'

type ChallengeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; reason: string; retryable: boolean }
  | { status: 'success'; result: ChallengeResult }

export function useChallengeClient() {
  const [state, setState] = useState<ChallengeState>({ status: 'idle' })

  const runChallenge = useCallback(async (context: ChallengeRequestContext) => {
    setState({ status: 'loading' })
    try {
      const response = await fetch('/.netlify/functions/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      })
      const body = await response.json().catch(() => null)

      if (!body || body.ok !== true) {
        setState({
          status: 'error',
          reason: body?.reason ?? 'ai_unavailable',
          retryable: body?.retryable ?? true,
        })
        return
      }

      const parsed = parseChallengeResult(body.result)
      if (!parsed.success) {
        setState({ status: 'error', reason: 'invalid_ai_response', retryable: false })
        return
      }

      setState({ status: 'success', result: parsed.data })
    } catch {
      setState({ status: 'error', reason: 'network_error', retryable: true })
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, runChallenge, reset }
}
