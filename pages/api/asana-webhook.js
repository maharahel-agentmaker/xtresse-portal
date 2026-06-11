// Asana webhook receiver for the Xtressé portal.
// 1) Handshake: echo the X-Hook-Secret header when Asana registers the webhook.
// 2) Events: when a comment starting with "@client" is added on a task in the
//    project, forward it to Slack via SLACK_WEBHOOK_CLIENT_REPLY.

const ASANA_API = 'https://app.asana.com/api/1.0'
const REPLY_TAG = '@client'

async function asanaGet(path) {
  const res = await fetch(`${ASANA_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.ASANA_API_TOKEN}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

function portalBase() {
  // Xtressé stores its domain as a full URL in NEXT_PUBLIC_PORTAL_URL.
  // Fall back to NEXT_PUBLIC_DOMAIN (bare host) if that's what's set.
  const url = process.env.NEXT_PUBLIC_PORTAL_URL
  if (url) return url.replace(/\/+$/, '')
  const domain = process.env.NEXT_PUBLIC_DOMAIN
  if (domain) return `https://${domain.replace(/\/+$/, '')}`
  return ''
}

async function postToSlack(taskName, taskGid, text) {
  const url = process.env.SLACK_WEBHOOK_CLIENT_REPLY
  if (!url) {
    console.warn('SLACK_WEBHOOK_CLIENT_REPLY not set — skipping Slack forward')
    return
  }
  const base = portalBase()
  const lines = [
    `:speech_balloon: *Reply sent to client* on *${taskName}*`,
    '',
    text,
  ]
  if (base) {
    lines.push('', `<${base}/?task=${taskGid}|Open in portal>`)
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') }),
  })
}

export default async function handler(req, res) {
  // 1) Handshake
  const hookSecret = req.headers['x-hook-secret']
  if (hookSecret) {
    res.setHeader('X-Hook-Secret', hookSecret)
    return res.status(200).send('')
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 2) Events — process BEFORE responding (Vercel freezes the function once a
  // response is sent). The work is quick: one fetch + one Slack post.
  try {
    const events = (req.body && req.body.events) || []
    for (const ev of events) {
      if (!ev.resource || ev.resource.resource_type !== 'story') continue
      if (ev.action && ev.action !== 'added') continue

      const storyGid = ev.resource.gid
      if (!storyGid) continue

      const story = await asanaGet(`/stories/${storyGid}?opt_fields=text,type,target.name,target.gid`)
      const s = story.data
      if (!s || s.type !== 'comment' || !s.text) continue

      if (s.text.trim().toLowerCase().startsWith(REPLY_TAG)) {
        let text = s.text.trim().slice(REPLY_TAG.length).replace(/^[\s:,-]+/, '').trim()
        const taskName = (s.target && s.target.name) || 'a task'
        const taskGid = (s.target && s.target.gid) || ''
        await postToSlack(taskName, taskGid, text)
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
  }

  return res.status(200).json({ received: true })
}
