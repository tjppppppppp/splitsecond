import { useCallback, useEffect, useState } from 'react'
import { generateId } from '../lib/id'
import { loadDecisions, saveDecisions } from '../lib/persistence'
import type { Criterion, Decision, Option, Score } from '../lib/types'

function nowIso(): string {
  return new Date().toISOString()
}

function touch(decision: Decision): Decision {
  return { ...decision, updatedAt: nowIso() }
}

export function useDecisionStore() {
  const [decisions, setDecisions] = useState<Decision[]>(() => loadDecisions())

  // Autosave on every change -- the safety net against losing in-progress
  // edits if a tab is closed unexpectedly.
  useEffect(() => {
    saveDecisions(decisions)
  }, [decisions])

  const createDecision = useCallback((title: string): Decision => {
    const decision: Decision = {
      id: generateId(),
      schemaVersion: 1,
      title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      options: [],
      criteria: [],
      scores: [],
    }
    setDecisions((prev) => [...prev, decision])
    return decision
  }, [])

  const deleteDecision = useCallback((decisionId: string) => {
    setDecisions((prev) => prev.filter((d) => d.id !== decisionId))
  }, [])

  const updateDecision = useCallback((decisionId: string, patch: Partial<Decision>) => {
    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? touch({ ...d, ...patch }) : d)),
    )
  }, [])

  const replaceDecisions = useCallback((next: Decision[]) => {
    setDecisions(next)
  }, [])

  const addOption = useCallback((decisionId: string, name: string) => {
    const option: Option = { id: generateId(), name }
    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? touch({ ...d, options: [...d.options, option] }) : d)),
    )
    return option
  }, [])

  const removeOption = useCallback((decisionId: string, optionId: string) => {
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === decisionId
          ? touch({
              ...d,
              options: d.options.filter((o) => o.id !== optionId),
              scores: d.scores.filter((s) => s.optionId !== optionId),
            })
          : d,
      ),
    )
  }, [])

  const addCriterion = useCallback((decisionId: string, name: string, weight = 0) => {
    const criterion: Criterion = { id: generateId(), name, weight }
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === decisionId ? touch({ ...d, criteria: [...d.criteria, criterion] }) : d,
      ),
    )
    return criterion
  }, [])

  const updateCriterion = useCallback(
    (decisionId: string, criterionId: string, patch: Partial<Criterion>) => {
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === decisionId
            ? touch({
                ...d,
                criteria: d.criteria.map((c) => (c.id === criterionId ? { ...c, ...patch } : c)),
              })
            : d,
        ),
      )
    },
    [],
  )

  const removeCriterion = useCallback((decisionId: string, criterionId: string) => {
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === decisionId
          ? touch({
              ...d,
              criteria: d.criteria.filter((c) => c.id !== criterionId),
              scores: d.scores.filter((s) => s.criterionId !== criterionId),
            })
          : d,
      ),
    )
  }, [])

  const setScore = useCallback(
    (decisionId: string, optionId: string, criterionId: string, patch: Partial<Score>) => {
      setDecisions((prev) =>
        prev.map((d) => {
          if (d.id !== decisionId) return d
          const existingIndex = d.scores.findIndex(
            (s) => s.optionId === optionId && s.criterionId === criterionId,
          )
          const nextScores = [...d.scores]
          if (existingIndex === -1) {
            nextScores.push({ optionId, criterionId, value: null, reasoning: '', ...patch })
          } else {
            nextScores[existingIndex] = { ...nextScores[existingIndex], ...patch }
          }
          return touch({ ...d, scores: nextScores })
        }),
      )
    },
    [],
  )

  return {
    decisions,
    createDecision,
    deleteDecision,
    updateDecision,
    replaceDecisions,
    addOption,
    removeOption,
    addCriterion,
    updateCriterion,
    removeCriterion,
    setScore,
  }
}
