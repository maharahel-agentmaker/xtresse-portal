// One-time setup helper. Visit this ONCE on the live site:
//   https://YOUR-DOMAIN/api/setup-webhook
// It registers an Asana webhook so @client comments forward to Slack.
//   ?action=list    → show existing webhooks pointing at this portal
//   ?action=delete  → remove this portal's webhook(s)
//   (no action)     → create the webhook
// Optional protection: set WEBHOOK_SETUP_KEY and visit /api/setup-webhook?key=YOUR_KEY

const ASANA_API = 'https://app.asana.com/api/1.0'

async function asana(path, options = {}) {
  const res = await fetch(`${ASANA_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.ASANA_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>body{font-family:'Playfair Display',Georgia,serif;max-width:640px;margin:60px auto;padding:0 20px;color:#191817;line-height:1.6}
  h1{font-weight:500}code,pre{font-family:ui-monospace,Menlo,monospace;background:#F7F5F0;padding:2px 6px;border-radius:4px}
  .ok{color:#F5A623}.err{color:#C15757}</style></head><body>${body}</body></html>`
}

export default async function handler(req, res) {
  const token = process.env.ASANA_API_TOKEN
  const projectId = process.env.NEXT_PUBLIC_ASANA_PROJECT_ID
  const setupKey = process.env.WEBHOOK_SETUP_KEY

  res.setHeader('Content-Type', 'text/html')

  if (setupKey && req.query.key !== setupKey) {
    return res.status(401).send(page('Not authorized', `<h1 class="err">Not authorized</h1><p>Add <code>?key=YOUR_KEY</code> to the URL.</p>`))
  }
  if (!token || !projectId) {
    return res.status(500).send(page('Missing config', `<h1 class="err">Missing configuration</h1><p>ASANA_API_TOKEN and NEXT_PUBLIC_ASANA_PROJECT_ID must be set.</p>`))
  }

  const target = `https://${req.headers.host}/api/asana-webhook`

  try {
    const proj = await asana(`/projects/${projectId}?opt_fields=workspace.gid,name`)
    const workspace = proj.json?.data?.workspace?.gid

    if (req.query.action === 'list') {
      const list = await asana(`/webhooks?workspace=${workspace}&opt_fields=target,resource.name,active`)
      const rows = (list.json.data || [])
        .map(w => `<li><code>${w.target}</code> → ${w.resource?.name || w.resource?.gid || ''} ${w.active ? '(active)' : '(inactive)'}</li>`)
        .join('') || '<li>None found.</li>'
      return res.status(200).send(page('Webhooks', `<h1>Registered webhooks</h1><ul>${rows}</ul>`))
    }

    if (req.query.action === 'delete') {
      const list = await asana(`/webhooks?workspace=${workspace}&opt_fields=target`)
      const mine = (list.json.data || []).filter(w => w.target === target)
      for (const w of mine) await asana(`/webhooks/${w.gid}`, { method: 'DELETE' })
      return res.status(200).send(page('Removed', `<h1 class="ok">Removed ${mine.length} webhook(s)</h1><p>Pointing at <code>${target}</code>.</p>`))
    }

    const existing = await asana(`/webhooks?workspace=${workspace}&opt_fields=target`)
    const already = (existing.json.data || []).some(w => w.target === target)
    if (already) {
      return res.status(200).send(page('Already set up', `<h1 class="ok">Already set up</h1><p>A webhook for this portal already exists, pointing at <code>${target}</code>. <code>@client</code> replies will forward to Slack.</p>`))
    }

    const create = await asana('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        data: { resource: projectId, target, filters: [{ resource_type: 'story', action: 'added' }] },
      }),
    })

    if (!create.ok) {
      const detail = JSON.stringify(create.json.errors || create.json)
      return res.status(create.status).send(page('Setup failed', `<h1 class="err">Setup failed</h1><p>Asana said:</p><pre>${detail}</pre><p>Most common cause: open this page on your live (https) site, not localhost.</p>`))
    }

    return res.status(200).send(page('Done', `<h1 class="ok">Webhook registered</h1><p>Your team's <code>@client</code> replies in Asana will now post to your client Slack channel and appear in the portal.</p><p>Target: <code>${target}</code></p>`))
  } catch (error) {
    return res.status(500).send(page('Error', `<h1 class="err">Error</h1><pre>${error.message}</pre>`))
  }
}
