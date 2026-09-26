import { CriterionEditor } from './CriterionEditor'
import { OptionEditor } from './OptionEditor'
import { ScoreGrid } from './ScoreGrid'
import { validateWeights } from '../../lib/validation'
import type { Criterion, Decision, Score } from '../../lib/types'

interface DecisionEditorProps {
  decision: Decision
  onUpdateDecision: (patch: Partial<Decision>) => void
  onAddOption: (name: string) => void
  onRemoveOption: (optionId: string) => void
  onAddCriterion: (name: string) => void
  onUpdateCriterion: (criterionId: string, patch: Partial<Criterion>) => void
  onRemoveCriterion: (criterionId: string) => void
  onScoreChange: (optionId: string, criterionId: string, patch: Partial<Score>) => void
}

export function DecisionEditor({
  decision,
  onUpdateDecision,
  onAddOption,
  onRemoveOption,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion,
  onScoreChange,
}: DecisionEditorProps) {
  const weights = validateWeights(decision.criteria)
  const canScore = decision.options.length > 0 && decision.criteria.length > 0 && weights.valid

  return (
    <div>
      <div className="card">
        <div className="field">
          <label htmlFor="decision-title">Title</label>
          <input
            id="decision-title"
            type="text"
            value={decision.title}
            onChange={(e) => onUpdateDecision({ title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="decision-description">Description (optional)</label>
          <textarea
            id="decision-description"
            value={decision.description ?? ''}
            onChange={(e) => onUpdateDecision({ description: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <OptionEditor
          options={decision.options}
          onAdd={onAddOption}
          onRemove={onRemoveOption}
        />
      </div>

      <div className="card">
        <CriterionEditor
          criteria={decision.criteria}
          onAdd={onAddCriterion}
          onUpdate={onUpdateCriterion}
          onRemove={onRemoveCriterion}
        />
      </div>

      <div className="card">
        {canScore ? (
          <ScoreGrid
            options={decision.options}
            criteria={decision.criteria}
            scores={decision.scores}
            onChange={onScoreChange}
          />
        ) : (
          <p className="banner banner-info">
            Add at least one option, at least one criterion, and make sure criteria weights total
            100% before scoring.
          </p>
        )}
      </div>
    </div>
  )
}
