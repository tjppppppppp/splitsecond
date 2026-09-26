import type { RobustnessLevel } from '../../lib/types'

const LABEL: Record<RobustnessLevel, string> = {
  robust: 'Robust',
  moderate: 'Moderate',
  fragile: 'Fragile',
  indeterminate: 'N/A',
}

export function RobustnessBadge({ level }: { level: RobustnessLevel }) {
  return <span className={`badge badge-${level}`}>{LABEL[level]}</span>
}
