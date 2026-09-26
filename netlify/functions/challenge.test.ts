import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HandlerEvent } from '@netlify/functions'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

const { handler } = await import('./challenge')

function validPayload() {
  return {
    schemaVersion: 1,
    missingCriteria: [],
    unsupportedAssumptions: [],
    doubleCountedFactors: [],
    uncertaintyFlags: [],
    biasFlags: [],
    whatWouldChangeYourMind: [],
    overallReasoningQualityNote: 'Looks reasonable.',
  }
}

function makeEvent(body: unknown): HandlerEvent {
  return {
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as HandlerEvent
}

const validContext = {
  decisionTitle: 'Test decision',
  options: [{ id: 'a', name: 'A' }],
  criteria: [{ id: 'c1', name: 'C', weight: 100 }],
  scores: [{ optionId: 'a', criterionId: 'c1', value: 8, reasoning: 'r' }],
  deterministicResult: { decisionId: 'd1', computedAt: '', breakdowns: [], ranking: ['a'], winnerOptionIds: ['a'], isComplete: true },
  sensitivitySummary: { overallRobustness: 'robust', topFragilePivots: [] },
}

describe('challenge function handler', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('happy path: returns {ok:true, result} matching the schema', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1', name: 'submit_challenge_result', input: validPayload() }],
    })

    const response = await handler(makeEvent(validContext), {} as never, undefined as never)
    expect(response).toBeTruthy()
    const body = JSON.parse((response as { body: string }).body)
    expect(body.ok).toBe(true)
    expect(body.result.overallReasoningQualityNote).toBe('Looks reasonable.')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('malformed AI response: returns a typed invalid_ai_response error, not a throw', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1', name: 'submit_challenge_result', input: { score: 9 } }],
    })

    const response = await handler(makeEvent(validContext), {} as never, undefined as never)
    const body = JSON.parse((response as { body: string }).body)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('invalid_ai_response')
  })

  it('missing ANTHROPIC_API_KEY: returns server_misconfigured without calling Anthropic', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const response = await handler(makeEvent(validContext), {} as never, undefined as never)
    const body = JSON.parse((response as { body: string }).body)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('server_misconfigured')
    expect(mockCreate).not.toHaveBeenCalled()

    process.env.ANTHROPIC_API_KEY = originalKey
  })
})
