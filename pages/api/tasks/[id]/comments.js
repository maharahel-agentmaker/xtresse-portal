// GET /api/tasks/[id]/comments
// Returns ONLY client-facing messages for a task:
//   • the client's own feedback (comments that start with [Client Feedback])
//   • Branday replies (comments that start with @client — tag stripped)
// All other Asana comments (internal team chatter) are filtered out here on the
// server, so they never reach the client's browser.

const ASANA_API = 'https://app.asana.com/api/1.0'

const CLIENT_TAG = '[client feedback]'
const REPLY_TAG = '@client'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const token = process.env.ASANA_API_TOKEN
  if (!token) return res.status(500).json({ error: 'API token not configured' })
  if (!id) return res.status(400).json({ error: 'Task ID is required' })

  try {
    const response = await fetch(
      `${ASANA_API}/tasks/${id}/stories?opt_fields=text,type,created_at,created_by.name`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    if (!response.ok) {
      const details = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch comments', details })
    }

    const data = await response.json()
    const stories = data.data || []

    const messages = []
    for (const s of stories) {
      if (s.type !== 'comment' || !s.text) continue
      const raw = s.text
      const lower = raw.trim().toLowerCase()

      if (lower.startsWith(CLIENT_TAG)) {
        // Client's own message — strip the [Client Feedback] tag
        const text = raw.trim().slice(raw.trim().toLowerCase().indexOf(CLIENT_TAG) + CLIENT_TAG.length).trim()
        messages.push({ gid: s.gid, side: 'client', author: 'You', text, created_at: s.created_at })
      } else if (lower.startsWith(REPLY_TAG)) {
        // Branday reply — strip the @client tag (and any leading punctuation/space)
        let text = raw.trim().slice(REPLY_TAG.length)
        text = text.replace(/^[\s:,-]+/, '').trim()
        messages.push({
          gid: s.gid,
          side: 'branday',
          author: (s.created_by && s.created_by.name) || 'Branday',
          text,
          created_at: s.created_at,
        })
      }
      // else: internal comment — skip entirely
    }

    messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    return res.status(200).json({ messages })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
