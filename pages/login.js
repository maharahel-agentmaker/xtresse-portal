import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { X } from '../components/brand'

export default function Login() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const portalName = process.env.NEXT_PUBLIC_PORTAL_NAME || 'Project Portal'

  const submit = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const next = typeof router.query.next === 'string' ? router.query.next : '/'
        window.location.href = next.startsWith('/') ? next : '/'
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Incorrect password.')
        setLoading(false)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>{portalName} — Sign in</title></Head>
      <div style={{ minHeight: '100vh', background: X.black, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/xtresse-logo.svg" alt={portalName} style={{ height: '28px', width: 'auto', filter: 'invert(1)' }} />
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '32px', boxShadow: '0 12px 40px rgba(25,24,23,0.25)' }}>
            <div className="x-eyebrow" style={{ marginBottom: '6px' }}>{portalName}</div>
            <h1 className="x-serif" style={{ fontSize: '26px', color: X.black, marginBottom: '22px' }}>Sign in</h1>

            <form onSubmit={submit}>
              <label className="x-eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="Enter portal password"
                style={{ width: '100%', padding: '12px', border: `1px solid ${X.lineStrong}`, borderRadius: '6px', fontSize: '15px', color: X.black, outline: 'none', fontFamily: 'inherit' }}
              />

              {error && (
                <p style={{ color: X.merlot, fontSize: '13px', marginTop: '10px' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="x-btn-primary"
                style={{ width: '100%', textAlign: 'center', justifyContent: 'center', marginTop: '20px', padding: '12px 20px', borderRadius: '6px', fontWeight: 500, fontSize: '14px', border: 'none', cursor: 'pointer', opacity: loading || !password ? 0.6 : 1 }}
              >
                {loading ? 'Checking…' : 'Enter portal'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', color: 'rgba(247,245,240,0.45)', fontSize: '12px', marginTop: '20px' }}>
            This portal is private. Please don't share your access.
          </p>
        </div>
      </div>
    </>
  )
}
