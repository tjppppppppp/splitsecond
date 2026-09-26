// The load-bearing artifact for the "AI never touches the score" rule.
//
// Every schema here is strict (rejects unknown keys) at every nesting level.
// There is deliberately no number/score/weight/ranking/winner/confidence
// field anywhere -- even a successful prompt injection that gets the model
// to emit one has nowhere to bind, and strict parsing drops it rather than
// passing it through.

import { z } from 'zod'

const LocationSchema = z.strictObject({
  optionId: z.string(),
  criterionId: z.string(),
})

export const ChallengeResultSchema = z.strictObject({
  schemaVersion: z.literal(1),
  missingCriteria: z.array(
    z.strictObject({
      suggestion: z.string(),
      rationale: z.string(),
    }),
  ),
  unsupportedAssumptions: z.array(
    z.strictObject({
      location: LocationSchema,
      assumption: z.string(),
      whyUnsupported: z.string(),
    }),
  ),
  doubleCountedFactors: z.array(
    z.strictObject({
      criterionIds: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
  uncertaintyFlags: z.array(
    z.strictObject({
      location: LocationSchema,
      concern: z.string(),
    }),
  ),
  biasFlags: z.array(
    z.strictObject({
      biasType: z.string(),
      location: LocationSchema.optional(),
      explanation: z.string(),
    }),
  ),
  whatWouldChangeYourMind: z.array(
    z.strictObject({
      statement: z.string(),
      relatedCriterionIds: z.array(z.string()),
    }),
  ),
  overallReasoningQualityNote: z.string(),
})

export type ChallengeResultParsed = z.infer<typeof ChallengeResultSchema>

export function parseChallengeResult(raw: unknown) {
  return ChallengeResultSchema.safeParse(raw)
}

// Hand-written JSON Schema mirror of the above, used as the Anthropic tool's
// input_schema (forced tool-choice) so the model can only emit fields this
// shape allows. Keep in sync with ChallengeResultSchema above.
export const CHALLENGE_RESULT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'missingCriteria',
    'unsupportedAssumptions',
    'doubleCountedFactors',
    'uncertaintyFlags',
    'biasFlags',
    'whatWouldChangeYourMind',
    'overallReasoningQualityNote',
  ],
  properties: {
    schemaVersion: { const: 1 },
    missingCriteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['suggestion', 'rationale'],
        properties: {
          suggestion: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
    unsupportedAssumptions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['location', 'assumption', 'whyUnsupported'],
        properties: {
          location: {
            type: 'object',
            additionalProperties: false,
            required: ['optionId', 'criterionId'],
            properties: { optionId: { type: 'string' }, criterionId: { type: 'string' } },
          },
          assumption: { type: 'string' },
          whyUnsupported: { type: 'string' },
        },
      },
    },
    doubleCountedFactors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterionIds', 'explanation'],
        properties: {
          criterionIds: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
        },
      },
    },
    uncertaintyFlags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['location', 'concern'],
        properties: {
          location: {
            type: 'object',
            additionalProperties: false,
            required: ['optionId', 'criterionId'],
            properties: { optionId: { type: 'string' }, criterionId: { type: 'string' } },
          },
          concern: { type: 'string' },
        },
      },
    },
    biasFlags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['biasType', 'explanation'],
        properties: {
          biasType: { type: 'string' },
          location: {
            type: 'object',
            additionalProperties: false,
            required: ['optionId', 'criterionId'],
            properties: { optionId: { type: 'string' }, criterionId: { type: 'string' } },
          },
          explanation: { type: 'string' },
        },
      },
    },
    whatWouldChangeYourMind: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['statement', 'relatedCriterionIds'],
        properties: {
          statement: { type: 'string' },
          relatedCriterionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    overallReasoningQualityNote: { type: 'string' },
  },
} as const
