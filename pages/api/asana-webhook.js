// Asana webhook receiver for the Xtressé portal.
//
// On a comment starting with "@client" on a task in the project:
//   1) ALWAYS post the reply to #xtresse-daily (team record) via the incoming
//      webhook in SLACK_WEBHOOK_CLIENT_REPLY.
//   2) ADDITIONALLY, email the task's "Requester Email" person the reply (via
//      Resend), with a link back to the portal. Works for external clients,
//      who are not in the Branday Slack. If there's no email or the send fails,
//      only the channel post happens — nothing is ever lost.
//
// When the reply is on a SUBTASK, both notifications show the MAIN (parent)
// task name as the headline with the subtask beneath it, and the requester
// email is read from the parent task if the subtask doesn't carry that field.
//
// Also handles the X-Hook-Secret handshake when Asana registers the webhook.

const ASANA_API = 'https://app.asana.com/api/1.0'
const RESEND_API = 'https://api.resend.com/emails'
const REPLY_TAG = '@client'

async function asanaGet(path) {
  const res = await fetch(`${ASANA_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.ASANA_API_TOKEN}`, 'Content-Type': 'application/json' },
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

// Escape user-provided text before putting it into the HTML email.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Remove Asana links (and any now-empty "CC" line) from text shown to clients.
// Clients can't open Asana, so these links are dead noise to them. Used only
// for client-facing output (the email) — internal channel posts keep them.
function stripAsanaLinks(text) {
  return String(text)
    .replace(/<https?:\/\/(?:app\.)?asana\.com\/[^>\s|]*(?:\|[^>]*)?>/gi, '')
    .replace(/https?:\/\/(?:app\.)?asana\.com\/\S+/gi, '')
    .replace(/^[ \t]*cc:?[ \t]*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Pull the "Requester email" value out of a custom_fields array. Matches the
// field name flexibly: "Requester email", "Requester Email", "Email", etc.
function extractRequesterEmail(fields) {
  const list = fields || []
  const byName = (pred) => list.find(f => f.name && pred(f.name.toLowerCase()))
  const field =
    byName(n => n.includes('requester') && n.includes('email')) ||
    byName(n => n.includes('requester')) ||
    byName(n => n.includes('email'))
  if (!field) return ''
  const val = (field.display_value || field.text_value || '').trim()
  return /\S+@\S+\.\S+/.test(val) ? val : ''
}

// Fetch the task the comment is on, plus its parent (if it's a subtask).
// Returns the display names and the requester email, reading the email from
// the parent task when the subtask itself doesn't carry that field.
async function getTaskContext(taskGid) {
  const empty = { mainName: 'a task', subName: '', requesterEmail: '' }
  if (!taskGid) return empty

  const data = await asanaGet(`/tasks/${taskGid}?opt_fields=name,parent.name,parent.gid,custom_fields.name,custom_fields.display_value,custom_fields.text_value`)
  const t = data.data
  if (!t) return empty

  const taskName = t.name || 'a task'
  const parentName = (t.parent && t.parent.name) || ''
  const parentGid = (t.parent && t.parent.gid) || ''

  let requesterEmail = extractRequesterEmail(t.custom_fields)

  // Subtasks usually don't carry the project's custom fields, so fall back to
  // the parent task's Requester Email.
  if (!requesterEmail && parentGid) {
    const pdata = await asanaGet(`/tasks/${parentGid}?opt_fields=custom_fields.name,custom_fields.display_value,custom_fields.text_value`)
    if (pdata.data) requesterEmail = extractRequesterEmail(pdata.data.custom_fields)
  }

  return {
    mainName: parentName || taskName,   // headline = main task
    subName: parentName ? taskName : '', // subtask shown beneath, only if nested
    requesterEmail,
  }
}

// Post to #xtresse-daily via the incoming webhook — happens every time.
async function postToChannel(mainName, subName, taskGid, text) {
  const url = process.env.SLACK_WEBHOOK_CLIENT_REPLY
  if (!url) {
    console.warn('SLACK_WEBHOOK_CLIENT_REPLY not set — skipping channel post')
    return
  }
  const base = portalBase()
  const lines = [`:speech_balloon: *Reply sent to client* on *${mainName}*`]
  if (subName) lines.push(`↳ ${subName}`)
  lines.push('', text)
  if (base) lines.push('', `<${base}/?task=${taskGid}|Open in portal>`)

  const payload = { text: lines.join('\n'), username: 'Xtressé Portal' }
  if (base) payload.icon_url = `${base}/xtresse-slack-icon.png`

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// Build the branded HTML body for the client notification email.
function buildEmailHtml(mainName, subName, text, portalLink) {
  const safeMain = escapeHtml(mainName)
  const safeSub = subName ? escapeHtml(subName) : ''
  const safeBody = escapeHtml(text).replace(/\n/g, '<br>')
  const regarding = safeSub
    ? `<p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8A8478;">Regarding: ${safeSub}</p>`
    : ''
  const button = portalLink
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
         <tr><td style="border-radius:6px;background:#191817;">
           <a href="${portalLink}" style="display:inline-block;padding:13px 30px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1;color:#F7F5F0;text-decoration:none;border-radius:6px;">Open in portal</a>
         </td></tr>
       </table>`
    : ''
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F0;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">You have a new message on ${safeMain} in the Xtressé portal.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E7E3DA;border-radius:10px;overflow:hidden;">
        <tr><td style="height:4px;background:#FFC45C;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 36px 8px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#A39C8E;text-transform:uppercase;">Xtressé Portal</div>
        </td></tr>
        <tr><td style="padding:8px 36px 0;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:24px;line-height:1.3;color:#191817;">You have a new message</h1>
          <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#4A4742;">There's a new reply for you on <strong style="color:#191817;">${safeMain}</strong>.</p>
          ${regarding}
        </td></tr>
        <tr><td style="padding:20px 36px 0;">
          <div style="border-left:3px solid #C15757;background:#F7F5F0;border-radius:0 6px 6px 0;padding:16px 18px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#191817;">${safeBody}</div>
        </td></tr>
        <tr><td style="padding:0 36px;">${button}</td></tr>
        <tr><td style="padding:16px 36px 34px;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#A39C8E;">You're receiving this because you're listed as the requester on this task in the Xtressé portal. Please reply inside the portal so your message is tracked with the project.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Email the requester via Resend. Returns true if the send was accepted.
async function emailRequester(email, mainName, subName, taskGid, text) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM_EMAIL
  if (!email) return false
  if (!apiKey) { console.warn('RESEND_API_KEY not set — skipping email'); return false }
  if (!from) { console.warn('NOTIFY_FROM_EMAIL not set — skipping email'); return false }

  try {
    const base = portalBase()
    const portalLink = base ? `${base}/?task=${taskGid}` : ''
    const clientText = stripAsanaLinks(text)

    const plainLines = [`You have a new message on "${mainName}".`]
    if (subName) plainLines.push(`Regarding: ${subName}`)
    plainLines.push('', clientText, '')
    if (portalLink) plainLines.push(`Open in portal: ${portalLink}`, '')
    plainLines.push("You're receiving this because you're listed as the requester on this task in the Xtressé portal.")

    const payload = {
      from,
      to: [email],
      subject: `New reply from Branday — "${mainName}"`,
      html: buildEmailHtml(mainName, subName, clientText, portalLink),
      text: plainLines.join('\n'),
    }
    if (process.env.NOTIFY_REPLY_TO) payload.reply_to = process.env.NOTIFY_REPLY_TO

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.id) {
      console.warn(`Email to ${email} failed: ${data.message || data.name || JSON.stringify(data)}`)
      return false
    }
    return true
  } catch (err) {
    console.error('emailRequester error:', err)
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

      const story = await asanaGet(`/stories/${storyGid}?opt_fields=text,type,target.gid`)
      const s = story.data
      if (!s || s.type !== 'comment' || !s.text) continue

      if (s.text.trim().toLowerCase().startsWith(REPLY_TAG)) {
        const text = s.text.trim().slice(REPLY_TAG.length).replace(/^[\s:,-]+/, '').trim()
        const taskGid = (s.target && s.target.gid) || ''

        const ctx = await getTaskContext(taskGid)

        // Always post to the team channel.
        await postToChannel(ctx.mainName, ctx.subName, taskGid, text)

        // Additionally email the requester if we have their address.
        if (ctx.requesterEmail) await emailRequester(ctx.requesterEmail, ctx.mainName, ctx.subName, taskGid, text)
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
  }

  return res.status(200).json({ received: true })
}
