import { useRef, useState } from 'react'
import { Button } from '../shared/Button'
import { EmptyState } from '../shared/EmptyState'
import type { Decision } from '../../lib/types'

interface DecisionListProps {
  decisions: Decision[]
  onSelect: (id: string) => void
  onCreate: (title: string) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (json: string) => void
}

export function DecisionList({
  decisions,
  onSelect,
  onCreate,
  onDelete,
  onExport,
  onImport,
}: DecisionListProps) {
  const [newTitle, setNewTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sorted = [...decisions].sort((a, z) => z.updatedAt.localeCompare(a.updatedAt))

  function handleCreate() {
    const title = newTitle.trim()
    if (!title) return
    onCreate(title)
    setNewTitle('')
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then(onImport)
    e.target.value = ''
  }

  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="new-decision-title">New decision</label>
            <input
              id="new-decision-title"
              type="text"
              placeholder="e.g. Which offer should I accept?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <Button variant="primary" onClick={handleCreate} disabled={!newTitle.trim()}>
            Create
          </Button>
        </div>
      </div>

      <div className="card">
        {sorted.length === 0 ? (
          <EmptyState
            title="No decisions yet"
            description="Create your first decision above to get started."
          />
        ) : (
          sorted.map((d) => (
            <div className="decision-list-item" key={d.id}>
              <div className="decision-list-item-main" onClick={() => onSelect(d.id)}>
                <span className="decision-list-item-title">{d.title}</span>
                <span className="decision-list-item-meta">
                  {d.options.length} option{d.options.length === 1 ? '' : 's'} &middot;{' '}
                  {d.criteria.length} criterion{d.criteria.length === 1 ? '' : 'a'} &middot; updated{' '}
                  {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete "${d.title}"? This cannot be undone.`)) onDelete(d.id)
                }}
              >
                Delete
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="row">
        <Button variant="secondary" onClick={onExport} disabled={decisions.length === 0}>
          Export JSON
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>
    </div>
  )
}
