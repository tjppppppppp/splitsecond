interface StalenessWarningProps {
  stale: boolean
  onRerun: () => void
}

export function StalenessWarning({ stale, onRerun }: StalenessWarningProps) {
  if (!stale) return null
  return (
    <p className="banner banner-warning" data-testid="staleness-warning">
      This analysis was run before your latest edits.{' '}
      <button className="btn btn-ghost" onClick={onRerun}>
        Re-run to refresh
      </button>
    </p>
  )
}
