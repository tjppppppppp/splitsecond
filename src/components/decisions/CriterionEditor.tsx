import { useState } from 'react'
import { Button } from '../shared/Button'
import { validateWeights } from '../../lib/validation'
import type { Criterion } from '../../lib/types'

interface CriterionEditorProps {
  criteria: Criterion[]
  onAdd: (name: string) => void
  onUpdate: (criterionId: string, patch: Partial<Criterion>) => void
  onRemove: (criterionId: string) => void
}

export function CriterionEditor({ criteria, onAdd, onUpdate, onRemove }: CriterionEditorProps) {
  const [name, setName] = useState('')
  const { valid, sum } = validateWeights(criteria)

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <div>
      <h3>Criteria</h3>
      {criteria.map((c) => (
        <div className="row-list-item" key={c.id}>
          <div className="field" style={{ flex: 2 }}>
            <input
              type="text"
              value={c.name}
              onChange={(e) => onUpdate(c.id, { name: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1, maxWidth: 90 }}>
            <input
              type="number"
              min={0}
              max={100}
              value={c.weight}
              onChange={(e) => onUpdate(c.id, { weight: Number(e.target.value) || 0 })}
            />
          </div>
          <span>%</span>
          <Button variant="ghost" onClick={() => onRemove(c.id)}>
            Remove
          </Button>
        </div>
      ))}
      <div className="row-list-item">
        <div className="field">
          <input
            type="text"
            placeholder="Add a criterion..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <Button variant="secondary" onClick={handleAdd} disabled={!name.trim()}>
          Add
        </Button>
      </div>

      <span className={`weight-status ${valid ? 'valid' : 'invalid'}`}>
        {valid
          ? 'Weights total 100% ✓'
          : sum < 100
            ? `${sum}/100 — add ${100 - sum} more`
            : `${sum}/100 — remove ${sum - 100}`}
      </span>
    </div>
  )
}
