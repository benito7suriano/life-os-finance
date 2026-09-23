import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetForm } from '../AssetForm'

const owner = { id: 'beno', name: 'Beno', ownerType: 'person' as const, includeInNetWorth: true }

describe('AssetForm', () => {
  it('switches to class-specific fields', async () => {
    render(<AssetForm open owners={[owner]} onClose={vi.fn()} onSave={vi.fn()} onCreateOwner={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'vehicle')
    expect(screen.getByLabelText('VIN')).toBeInTheDocument()
    expect(screen.getByLabelText('Current mileage')).toBeInTheDocument()
    expect(screen.queryByLabelText('Property type')).not.toBeInTheDocument()
  })

  it('requires ownership to total 100%', async () => {
    const onSave = vi.fn()
    render(<AssetForm open owners={[owner]} onClose={vi.fn()} onSave={onSave} onCreateOwner={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Name'), 'New home')
    await userEvent.clear(screen.getByLabelText('Ownership percentage'))
    await userEvent.type(screen.getByLabelText('Ownership percentage'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Create asset' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ownership allocations must total 100%')
    expect(onSave).not.toHaveBeenCalled()
  })
})
