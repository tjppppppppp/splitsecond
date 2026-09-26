import { useState } from 'react'
import { Button } from '../shared/Button'
import type { Option } from '../../lib/types'

interface OptionEditorProps {
  options: Option[]
  onAdd: (name: string) => void
  onRemove: (optionId: string) => void
}

export function OptionEditor({ options, onAdd, onRemove }: OptionEditorProps) {
  const [name, setName] = useState('')

  function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <div>
      <h3>Options</h3>
      {options.map((o) => (
        <div className="row-list-item" key={o.id}>
          <span style={{ flex: 1 }}>{o.name}</span>
          <Button variant="ghost" onClick={() => onRemove(o.id)}>
            Remove
          </Button>
        </div>
      ))}
      <div className="row-list-item">
        <div className="field">
          <input
            type="text"
            placeholder="Add an option..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <Button variant="secondary" onClick={handleAdd} disabled={!name.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}
