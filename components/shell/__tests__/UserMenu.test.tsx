import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/shell/UserMenu'

describe('UserMenu', () => {
  const defaultUser = {
    name: 'John Doe',
    email: 'john@example.com',
  }

  it('renders user initials when no avatar provided', () => {
    render(<UserMenu user={defaultUser} isCollapsed={false} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders user name and email when expanded', () => {
    render(<UserMenu user={defaultUser} isCollapsed={false} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('hides name and email text when collapsed', () => {
    render(<UserMenu user={defaultUser} isCollapsed={true} />)
    // In collapsed mode, name/email should not be shown inline (only in dropdown)
    const paragraphs = document.querySelectorAll('p')
    // The button area should not have name/email paragraphs
    expect(paragraphs.length).toBe(0)
  })

  it('opens dropdown menu on click', async () => {
    const user = userEvent.setup()
    render(<UserMenu user={defaultUser} isCollapsed={false} />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Log out')).toBeInTheDocument()
  })

  it('calls onLogout when logout is clicked', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<UserMenu user={defaultUser} isCollapsed={false} onLogout={onLogout} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Log out'))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('calls onNavigate with /settings when settings is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<UserMenu user={defaultUser} isCollapsed={false} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Settings'))
    expect(onNavigate).toHaveBeenCalledWith('/settings')
  })

  it('closes dropdown after clicking an option', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<UserMenu user={defaultUser} isCollapsed={false} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Settings')).toBeInTheDocument()

    await user.click(screen.getByText('Settings'))
    // Dropdown should close - Settings button from dropdown should be gone
    expect(screen.queryByText('Log out')).not.toBeInTheDocument()
  })

  it('renders avatar image when avatarUrl is provided', () => {
    const userWithAvatar = {
      ...defaultUser,
      avatarUrl: 'https://example.com/avatar.jpg',
    }
    render(<UserMenu user={userWithAvatar} isCollapsed={false} />)
    const img = document.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img?.src).toContain('avatar.jpg')
  })
})
