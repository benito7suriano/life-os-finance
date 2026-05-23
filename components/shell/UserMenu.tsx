'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut, ChevronUp } from 'lucide-react'
import { Avatar } from '@/components/ui'

export interface User {
  name: string
  email: string
  avatarUrl?: string
}

export interface UserMenuProps {
  user: User
  isCollapsed: boolean
  onLogout?: () => void
  onNavigate?: (href: string) => void
}

export function UserMenu({ user, isCollapsed, onLogout, onNavigate }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center text-left"
        style={{
          gap: 12,
          borderRadius: 12,
          padding: 6,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          background: isOpen ? 'rgba(255,255,255,0.04)' : 'transparent',
          transition: 'background .15s',
        }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="h-9 w-9 shrink-0 aspect-square rounded-full object-cover" />
        ) : (
          <Avatar initials={initials} size={36} />
        )}

        {!isCollapsed && (
          <>
            <div className="flex-1 overflow-hidden">
              <p className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                {user.name}
              </p>
              <p className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)' }}>
                {user.email}
              </p>
            </div>
            <ChevronUp size={16} style={{ color: 'var(--fg3)', transform: isOpen ? 'none' : 'rotate(180deg)', transition: 'transform .15s' }} />
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-56 py-1 ${isCollapsed ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-2'}`}
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--card-border)',
            borderRadius: 14,
            boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)',
          }}
        >
          {isCollapsed && (
            <div style={{ borderBottom: '1px solid var(--card-border)', padding: '8px 12px' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{user.name}</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)' }}>{user.email}</p>
            </div>
          )}

          <button
            onClick={() => {
              onNavigate?.('/settings')
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-2"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}
          >
            <Settings size={16} />
            Settings
          </button>

          <div style={{ margin: '4px 0', borderTop: '1px solid var(--card-border)' }} />

          <button
            onClick={() => {
              onLogout?.()
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-2"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--bad)' }}
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
