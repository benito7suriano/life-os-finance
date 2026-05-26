import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>connected</Badge>)
    expect(screen.getByText('connected')).toBeInTheDocument()
  })

  it('renders a status dot when dot is set', () => {
    const { container } = render(
      <Badge tone="good" dot>
        live
      </Badge>,
    )
    // label text node + the dot span
    expect(container.querySelectorAll('span').length).toBeGreaterThanOrEqual(2)
  })
})
