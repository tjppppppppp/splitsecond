import { useState } from 'react'
import { ChallengePanel } from './components/ai/ChallengePanel'
import { DecisionEditor } from './components/decisions/DecisionEditor'
import { DecisionList } from './components/decisions/DecisionList'
import { ResultsView } from './components/results/ResultsView'
import { SensitivityView } from './components/sensitivity/SensitivityView'
import { Button } from './components/shared/Button'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { useDecisionStore } from './hooks/useDecisionStore'
import { exportToJson, importFromJson } from './lib/persistence'

type Tab = 'edit' | 'results' | 'sensitivity' | 'challenge'

function App() {
  const store = useDecisionStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('edit')

  const selected = selectedId ? store.decisions.find((d) => d.id === selectedId) : undefined

  function handleExport() {
    const json = exportToJson(store.decisions)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'splitsecond-decisions.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(json: string) {
    const { decisions, errors } = importFromJson(json, store.decisions)
    store.replaceDecisions(decisions)
    if (errors.length > 0) {
      alert(`Import finished with ${errors.length} issue(s):\n${errors.join('\n')}`)
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1 className="app-title">SplitSecond</h1>
            <p className="app-tagline">Structured decisions, deterministic scoring.</p>
          </div>
          {selected && (
            <Button variant="secondary" onClick={() => setSelectedId(null)}>
              &larr; All decisions
            </Button>
          )}
        </header>

        {!selected ? (
          <DecisionList
            decisions={store.decisions}
            onSelect={(id) => {
              setSelectedId(id)
              setActiveTab('edit')
            }}
            onCreate={(title) => {
              const d = store.createDecision(title)
              setSelectedId(d.id)
              setActiveTab('edit')
            }}
            onDelete={store.deleteDecision}
            onExport={handleExport}
            onImport={handleImport}
          />
        ) : (
          <div>
            <nav className="tab-bar">
              {(['edit', 'results', 'sensitivity', 'challenge'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'edit'
                    ? 'Edit'
                    : tab === 'results'
                      ? 'Results'
                      : tab === 'sensitivity'
                        ? 'Sensitivity'
                        : 'Challenge'}
                </button>
              ))}
            </nav>

            {activeTab === 'edit' && (
              <DecisionEditor
                decision={selected}
                onUpdateDecision={(patch) => store.updateDecision(selected.id, patch)}
                onAddOption={(name) => store.addOption(selected.id, name)}
                onRemoveOption={(optionId) => store.removeOption(selected.id, optionId)}
                onAddCriterion={(name) => store.addCriterion(selected.id, name)}
                onUpdateCriterion={(criterionId, patch) =>
                  store.updateCriterion(selected.id, criterionId, patch)
                }
                onRemoveCriterion={(criterionId) => store.removeCriterion(selected.id, criterionId)}
                onScoreChange={(optionId, criterionId, patch) =>
                  store.setScore(selected.id, optionId, criterionId, patch)
                }
              />
            )}
            {activeTab === 'results' && <ResultsView decision={selected} />}
            {activeTab === 'sensitivity' && <SensitivityView decision={selected} />}
            {activeTab === 'challenge' && (
              <ChallengePanel
                decision={selected}
                onChallengeStored={(lastChallenge) =>
                  store.updateDecision(selected.id, { lastChallenge })
                }
              />
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
