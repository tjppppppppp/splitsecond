import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StalenessWarning } from './StalenessWarning'

describe('StalenessWarning', () => {
  it('renders nothing when not stale', () => {
    render(<StalenessWarning stale={false} onRerun={vi.fn()} />)
    expect(screen.queryByTestId('staleness-warning')).toBeNull()
  })

  it('renders the banner when stale', () => {
    render(<StalenessWarning stale={true} onRerun={vi.fn()} />)
    expect(screen.getByTestId('staleness-warning')).toBeInTheDocument()
  })
})
