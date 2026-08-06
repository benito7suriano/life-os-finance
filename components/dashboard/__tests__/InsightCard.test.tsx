import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsightCard } from '../InsightCard'
import sampleData from '../sample-data.json'
import type { Summary } from '../types'
import type { Insight } from '@/lib/insights/types'

const summary = sampleData.summary as unknown as Summary

const insights: Insight[] = [
  {
    id: 'cc_payment_due:visa:2026-08',
    kind: 'cc_payment_due',
    score: 90,
    headline: { lead: 'Payment for ', accent: 'VISA PLATINUM', tail: ' is due in 2 days — you owe $674.18.' },
    body: 'Schedule the transfer now to avoid interest and late fees.',
    cta: { label: 'View accounts', href: '/accounts' },
  },
  {
    id: 'savings_rate:2026-08',
    kind: 'savings_rate',
    score: 10,
    headline: { lead: 'This month you saved ', accent: '$1,859.50', tail: '.' },
    body: "That's a 44% savings rate so far this month.",
    cta: { label: 'See transactions', href: '/transactions' },
  },
]

describe('InsightCard', () => {
  it('renders the top-ranked insight with its CTA and counter', () => {
    render(<InsightCard summary={summary} insights={insights} />)
    expect(screen.getByText('VISA PLATINUM')).toBeInTheDocument()
    expect(screen.getByText(/Schedule the transfer now/)).toBeInTheDocument()
    expect(screen.getByText('View accounts')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('advances through insights on Dismiss and ends in a caught-up state', async () => {
    const user = userEvent.setup()
    render(<InsightCard summary={summary} insights={insights} />)
    await user.click(screen.getByText('Dismiss'))
    expect(screen.getByText('$1,859.50')).toBeInTheDocument()
    await user.click(screen.getByText('Dismiss'))
    expect(screen.getByText(/all caught up/)).toBeInTheDocument()
    // ...and can restart the cycle
    await user.click(screen.getByText('Show again'))
    expect(screen.getByText('VISA PLATINUM')).toBeInTheDocument()
  })

  it('sends the CTA href through onNavigate', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<InsightCard summary={summary} insights={insights} onNavigate={onNavigate} />)
    await user.click(screen.getByText('View accounts'))
    expect(onNavigate).toHaveBeenCalledWith('/accounts')
  })

  it('falls back to the budget-projection template when no insights are given', () => {
    // sample summary: status=warning, projectedOverspend=312
    render(<InsightCard summary={summary} />)
    expect(screen.getByText('$312.00')).toBeInTheDocument()
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()
  })

  it('shows the generation time only when provided', () => {
    const { rerender } = render(<InsightCard summary={summary} insights={insights} generatedAt="2026-08-05T14:30:00Z" />)
    expect(screen.getByText(/generated /)).toBeInTheDocument()
    rerender(<InsightCard summary={summary} insights={insights} />)
    expect(screen.queryByText(/generated /)).not.toBeInTheDocument()
  })
})
