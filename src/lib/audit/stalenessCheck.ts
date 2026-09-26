// A stable (non-cryptographic) hash over the parts of a Decision that matter
// for the reasoning audit: options, criteria, and scores/reasoning.
// Deliberately excludes createdAt/updatedAt so touching timestamps alone
// never triggers a false "stale" warning.

import type { Decision } from '../types'

function canonicalize(decision: Decision): string {
  const options = [...decision.options]
    .sort((a, z) => a.id.localeCompare(z.id))
    .map((o) => ({ id: o.id, name: o.name, description: o.description ?? '' }))

  const criteria = [...decision.criteria]
    .sort((a, z) => a.id.localeCompare(z.id))
    .map((c) => ({ id: c.id, name: c.name, weight: c.weight, description: c.description ?? '' }))

  const scores = [...decision.scores]
    .sort((a, z) => (a.optionId + a.criterionId).localeCompare(z.optionId + z.criterionId))
    .map((s) => ({
      optionId: s.optionId,
      criterionId: s.criterionId,
      value: s.value,
      reasoning: s.reasoning,
    }))

  return JSON.stringify({ title: decision.title, description: decision.description ?? '', options, criteria, scores })
}

/** FNV-1a, 32-bit. Not cryptographic -- just needs to be stable and cheap. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

export function hashDecisionContent(decision: Decision): string {
  return fnv1a(canonicalize(decision))
}

export function isAuditStale(decision: Decision, lastAuditHash: string): boolean {
  return hashDecisionContent(decision) !== lastAuditHash
}
