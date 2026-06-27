// Asana webhook receiver for the Xtressé portal.
//
// On a comment starting with "@client" on a task in the project:
//   1) ALWAYS post the reply to #xtresse-daily (team record) via the incoming
//      webhook in SLACK_WEBHOOK_CLIENT_REPLY.
//   2) ADDITIONALLY, read the task's "Requester Email" custom field, look up
//      that person in Slack by email, and DM them the same reply (sent by the
//      bot, so it shows as "Xtressé Portal"). If there's no email or no match,
//      only the channel post happens — nothing is ever lost.
//
// Also handles the X-Hook-Secret handshake when Asana registers the webhook.

const ASANA_API = 'https://app.asana.com/api/1.0'
const SLACK_API = 'https://slack.com/api'
const REPLY_TAG = '@client'

async function asanaGet(path) {
  const res = await fetch(`${ASANA_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.ASANA_API_TOKEN}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

// Call a Slack Web API method with the bot token (JSON body).
// NOTE: this works for methods that accept JSON, such as conversations.open
// and chat.postMessage. It does NOT work for users.lookupByEmail — see below.
async function slackApi(method, body) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

// users.lookupByEmail does NOT accept a JSON body — it only reads
// form-urlencoded parameters. Sending JSON makes Slack ignore the email and
// return "invalid_arguments". So this one call is encoded as a form post.
async function slackLookupByEmail(email) {
  const res = await fetch(`${SLACK_API}/users.lookupByEmail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ email }).toString(),
  })
  return res.json()
}

function portalBase() {
  const url = process.env.NEXT_PUBLIC_PORTAL_URL
  if (url) return url.replace(/\/+$/, '')
  const domain = process.env.NEXT_PUBLIC_DOMAIN
  if (domain) return `https://${domain.replace(/\/+$/, '')}`
  return ''
}

// Read the "Requester email" custom field off a task. Matches the field name
// flexibly: "Requester email", "Requester Email", "Email", etc.
async function getRequesterEmail(taskGid) {
  if (!taskGid) return ''
  const data = await asanaGet(`/tasks/${taskGid}?opt_fields=custom_fields.name,custom_fields.display_value,custom_fields.text_value`)
  const fields = (data.data && data.data.custom_fields) || []
  const byName = (pred) => fields.find(f => f.name && pred(f.name.toLowerCase()))
  const field =
    byName(n => n.includes('requester') && n.includes('email')) ||
    byName(n => n.includes('requester')) ||
    byName(n => n.includes('email'))
  if (!field) return ''
  const val = (field.display_value || field.text_value || '').trim()
  // basic sanity check that it looks like an email
  return /\S+@\S+\.\S+/.test(val) ? val : ''
}

// Post to #xtresse-daily via the incoming webhook — happens every time.
async function postToChannel(taskName, taskGid, text) {
  const url = process.env.SLACK_WEBHOOK_CLIENT_REPLY
  if (!url) {
    console.warn('SLACK_WEBHOOK_CLIENT_REPLY not set — skipping channel post')
    return
  }
  const base = portalBase()
  const lines = [`:speech_balloon: *Reply sent to client* on *${taskName}*`, '', text]
  if (base) lines.push('', `<${base}/?task=${taskGid}|Open in portal>`)

  const payload = { text: lines.join('\n'), username: 'Xtressé Portal' }
  if (base) payload.icon_url = `${base}/xtresse-slack-icon.png`

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// DM the requester, if we can find them in Slack by their email.
// Returns true if a DM was sent.
async function dmRequester(email, taskName, taskGid, text) {
  if (!process.env.SLACK_BOT_TOKEN || !email) return false
  try {
    const lookup = await slackLookupByEmail(email)
    if (!lookup.ok || !lookup.user) {
      console.warn(`No Slack user for ${email}: ${lookup.error || 'not found'}`)
      return false
    }
    const userId = lookup.user.id

    const open = await slackApi('conversations.open', { users: userId })
    if (!open.ok || !open.channel) {
      console.warn(`Could not open DM with ${email}: ${open.error}`)
      return false
    }

    const base = portalBase()
    const lines = [`:speech_balloon: *New reply on ${taskName}*`, '', text]
    if (base) lines.push('', `<${base}/?task=${taskGid}|Open in portal>`)

    const post = await slackApi('chat.postMessage', {
      channel: open.channel.id,
      text: lines.join('\n'),
    })
    if (!post.ok) {
      console.warn(`DM to ${email} failed: ${post.error}`)
      return false
    }
    return true
  } catch (err) {
    console.error('dmRequester error:', err)
    return false
  }
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
  // response is sent).
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
        const text = s.text.trim().slice(REPLY_TAG.length).replace(/^[\s:,-]+/, '').trim()
        const taskName = (s.target && s.target.name) || 'a task'
        const taskGid = (s.target && s.target.gid) || ''

        // Always post to the team channel.
        await postToChannel(taskName, taskGid, text)

        // Additionally DM the requester if we can match their email.
        const email = await getRequesterEmail(taskGid)
        if (email) await dmRequester(email, taskName, taskGid, text)
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
  }

  return res.status(200).json({ received: true })
}
