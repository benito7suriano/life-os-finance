import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Progress } from '@/components/ui/Progress'

function innerWidth(container: HTMLElement): string {
  const outer = container.firstElementChild as HTMLElement
  const inner = outer.firstElementChild as HTMLElement
  return inner.style.width
}

describe('Progress', () => {
  it('fills proportionally to value/max', () => {
    const { container } = render(<Progress value={25} max={100} />)
    expect(innerWidth(container)).toBe('25%')
  })

  it('clamps values above max to 100%', () => {
    const { container } = render(<Progress value={150} max={100} />)
    expect(innerWidth(container)).toBe('100%')
  })

  it('clamps negative values to 0%', () => {
    const { container } = render(<Progress value={-10} max={100} />)
    expect(innerWidth(container)).toBe('0%')
  })
})
