import type { WeightPivot } from '../../lib/types'

interface TornadoChartProps {
  pivots: WeightPivot[]
  criterionNames: Record<string, string>
}

const TRACK_WIDTH = 100

export function TornadoChart({ pivots, criterionNames }: TornadoChartProps) {
  if (pivots.length === 0) return null

  const maxDelta = Math.max(1, ...pivots.map((p) => p.minWeightDeltaToFlip ?? 0))

  return (
    <div>
      {pivots.map((p) => {
        const name = criterionNames[p.criterionId] ?? p.criterionId
        const delta = p.minWeightDeltaToFlip
        const barWidth = delta === null ? TRACK_WIDTH : Math.max(2, (delta / maxDelta) * TRACK_WIDTH)
        const color = delta === null ? 'var(--color-robust)' : delta <= 5 ? 'var(--color-fragile)' : delta <= 15 ? 'var(--color-moderate)' : 'var(--color-robust)'
        return (
          <div className="tornado-row" key={p.criterionId}>
            <span className="tornado-label">{name}</span>
            <svg className="tornado-track" viewBox={`0 0 ${TRACK_WIDTH} 18`} preserveAspectRatio="none" role="img" aria-label={`${name}: ${delta === null ? 'no flip found' : `flips at ±${delta} weight points`}`}>
              <rect x={0} y={0} width={TRACK_WIDTH} height={18} rx={3} fill="var(--color-border)" />
              <rect x={0} y={0} width={barWidth} height={18} rx={3} fill={color} />
            </svg>
            <span>{delta === null ? 'robust' : `±${delta} pts`}</span>
          </div>
        )
      })}
    </div>
  )
}
