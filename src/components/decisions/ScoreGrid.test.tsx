import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScoreGrid } from './ScoreGrid'

const options = [
  { id: 'a', name: 'Option A' },
  { id: 'b', name: 'Option B' },
]
const criteria = [
  { id: 'c1', name: 'Cost', weight: 60 },
  { id: 'c2', name: 'Quality', weight: 40 },
]

describe('ScoreGrid', () => {
  it('renders one score+reasoning cell per option x criterion pair', () => {
    render(<ScoreGrid options={options} criteria={criteria} scores={[]} onChange={vi.fn()} />)
    // 2 options x 2 criteria = 4 numeric score inputs and 4 reasoning textareas
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4)
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('calls onChange with the right option/criterion ids when a score changes', () => {
    const onChange = vi.fn()
    render(<ScoreGrid options={options} criteria={criteria} scores={[]} onChange={onChange} />)
    const input = screen.getByLabelText('Option A score for Cost')
    fireEvent.change(input, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith('a', 'c1', { value: 7 })
  })

  it('calls onChange with reasoning text for the right cell', () => {
    const onChange = vi.fn()
    render(<ScoreGrid options={options} criteria={criteria} scores={[]} onChange={onChange} />)
    const textarea = screen.getByLabelText('Option B reasoning for Quality')
    fireEvent.change(textarea, { target: { value: 'Because X' } })
    expect(onChange).toHaveBeenCalledWith('b', 'c2', { reasoning: 'Because X' })
  })
})
