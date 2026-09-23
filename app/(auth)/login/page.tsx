'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui'

// A greeting is a lead phrase plus an accent-colored tail (name or "sir").
type Greeting = { lead: string; accent: string }

const ALWAYS: Greeting[] = [
  { lead: 'Welcome back, ', accent: 'sir' },
  { lead: 'Hi there, ', accent: 'Beno' },
  { lead: 'Good to see you ', accent: 'again' },
]

const MORNING: Greeting[] = [
  { lead: 'Rise and shine, ', accent: 'sir' },
  { lead: 'Good morning, ', accent: 'Beno' },
]

const AFTERNOON: Greeting[] = [
  { lead: 'Good afternoon, ', accent: 'Beno' },
  { lead: 'Finish the day strong, ', accent: 'Beno' },
]

const EVENING: Greeting[] = [
  { lead: 'Good evening, ', accent: 'Beno' },
  { lead: 'Finish the day strong, ', accent: 'Beno' },
]

function pickGreeting(): Greeting {
  const hour = new Date().getHours()
  const timely = hour < 12 ? MORNING : hour < 18 ? AFTERNOON : EVENING
  const pool = [...ALWAYS, ...timely]
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  // Stable default for SSR; randomized on the client to avoid hydration mismatch.
  const [greeting, setGreeting] = useState<Greeting>(ALWAYS[1])
  const router = useRouter()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only randomization avoids hydration mismatch
    setGreeting(pickGreeting())
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    setSignUpSuccess(false)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
    } else {
      setSignUpSuccess(true)
    }
    setLoading(false)
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    lineHeight: 1,
    color: 'var(--fg3)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 7,
    display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--fg)',
    fontFamily: 'var(--font-sans)',
    fontSize: 15,
    width: '100%',
    padding: 0,
  }
  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid var(--card-border)',
    borderRadius: 12,
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-10"
      style={{
        background: `
          radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--accent-b) 12%, transparent), transparent 70%),
          radial-gradient(40% 40% at 50% 100%, color-mix(in srgb, var(--accent-a) 8%, transparent), transparent 70%),
          var(--bg)
        `,
        color: 'var(--fg)',
      }}
    >
      {/* top-left mark */}
      <div className="absolute flex items-center gap-2.5" style={{ top: 28, left: 32 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b0d18',
            fontWeight: 800,
            fontSize: 15,
            fontFamily: 'var(--font-display)',
            boxShadow: '0 8px 24px -8px var(--accent-b)',
          }}
        >
          L
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--fg2)' }}>Ledger</span>
      </div>

      {/* center card */}
      <div className="w-full max-w-full" style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* greeting */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 500, lineHeight: 1.05, color: 'var(--fg)', letterSpacing: '-0.022em' }}>
            {greeting.lead}
            <span style={{ color: 'var(--accent-a)' }}>{greeting.accent}</span>.
          </h1>
        </div>

        {/* form */}
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(251,113,133,0.1)',
                border: '1px solid rgba(251,113,133,0.25)',
                color: 'var(--bad)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {signUpSuccess && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.25)',
                color: 'var(--good)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
              }}
            >
              Check your email for a confirmation link.
            </div>
          )}

          {/* email */}
          <div style={fieldStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor="email" style={labelStyle}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>
          </div>

          {/* password */}
          <div style={fieldStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: showPw ? '0.04em' : '0.14em' }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              title={showPw ? 'Hide password' : 'Show password'}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg3)', padding: 6, borderRadius: 8, display: 'flex' }}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth iconRight={ArrowRight} disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <Button type="button" variant="secondary" size="lg" fullWidth disabled={loading} onClick={handleSignUp}>
            Create account
          </Button>
        </form>
      </div>

      {/* footer */}
      <div
        className="absolute"
        style={{ bottom: 24, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1, color: 'var(--fg4)', letterSpacing: '0.08em' }}
      >
        Ledger · personal
      </div>
    </div>
  )
}
