// Checks the submitted password and, if correct, sets the auth cookie.
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expectedPassword = process.env.PORTAL_PASSWORD
  const token = process.env.PORTAL_AUTH_TOKEN
  if (!expectedPassword || !token) {
    return res.status(500).json({ error: 'Password protection is not configured.' })
  }

  const { password } = req.body || {}
  if (!password || password !== expectedPassword) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' })
  }

  // 30-day cookie. Secure only in production so it still works on http://localhost.
  const maxAge = 60 * 60 * 24 * 30
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  res.setHeader(
    'Set-Cookie',
    `portal_auth=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAge}`
  )
  return res.status(200).json({ ok: true })
}
