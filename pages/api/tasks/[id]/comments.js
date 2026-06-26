// GET /api/tasks/[id]/comments
// Returns client-facing messages for a task PLUS only client-facing files:
//   • files Branday attached inside an @client comment (ANY type — matched by
//     every asset reference in the comment markup, intersected with real
//     attachments on the task), and
//   • files the client uploaded through the portal (matched by the "Uploaded:"
//     names in their [Client Feedback] comment, by name AND upload time).
// Internal attachments (working files, pasted screenshots, Figma links) are
// filtered out here and never reach the client.

const ASANA_API = 'https://app.asana.com/api/1.0'

const CLIENT_TAG = '[client feedback]'
const REPLY_TAG = '@client'

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i
// A file embedded in a comment (image OR any file type) is referenced by its
// gid in one of these forms. We extract greedily, then keep only gids that
// match a REAL attachment on the task — gids are globally unique, so anything
// that isn't an attachment simply won't match.
const ASSET_PATTERNS = [
  /get_asset\?asset_id=(\d+)/g,   // plain-text + href form
  /data-asana-gid="(\d+)"/g,      // html_text rich-text node form
  /\/get_asset\/(\d+)/g,          // alternate asset URL form
]
const ASSET_URL_RE = /https?:\/\/app\.asana\.com\/\S*get_asset\?asset_id=\d+/g
const UPLOAD_WINDOW_MS = 10 * 60 * 1000 // 10 min around the [Client Feedback] comment

function collectAssetGids(haystack, set) {
  for (const re of ASSET_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(haystack)) !== null) set.add(m[1])
  }
}

async function asanaGet(path, token) {
  return fetch(`${ASANA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

// Strip the raw get_asset URLs from text shown in the conversation (the files
// appear in "Shared files" instead), and tidy leftover whitespace.
function cleanText(t) {
  return (t || '')
    .replace(ASSET_URL_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const token = process.env.ASANA_API_TOKEN
  if (!token) return res.status(500).json({ error: 'API token not configured' })
  if (!id) return res.status(400).json({ error: 'Task ID is required' })

  try {
    // --- 1) Stories (comments) ---
    const storyRes = await asanaGet(
      `/tasks/${id}/stories?opt_fields=text,html_text,type,created_at,created_by.name`,
      token
    )
    if (!storyRes.ok) {
      const details = await storyRes.text()
      return res.status(storyRes.status).json({ error: 'Failed to fetch comments', details })
    }
    const stories = (await storyRes.json()).data || []

    const messages = []
    const allowedGids = new Set()   // files embedded in client-facing comments
    const clientUploads = []        // { names:Set<string>, time:number } per [Client Feedback]

    for (const s of stories) {
      if (s.type !== 'comment' || !s.text) continue
      const raw = s.text.trim()
      const lower = raw.toLowerCase()
      const isClient = lower.startsWith(CLIENT_TAG)
      const isReply = lower.startsWith(REPLY_TAG)
      if (!isClient && !isReply) continue

      // Any file referenced in this client-facing comment (text + html markup).
      collectAssetGids(`${s.text || ''} ${s.html_text || ''}`, allowedGids)

      if (isClient) {
        const text = cleanText(raw.slice(raw.toLowerCase().indexOf(CLIENT_TAG) + CLIENT_TAG.length))
        messages.push({ gid: s.gid, side: 'client', author: 'You', text, created_at: s.created_at })

        const um = raw.match(/uploaded:\s*([^\n]+)/i)
        if (um) {
          const names = new Set(um[1].split(',').map(n => n.trim()).filter(Boolean))
          if (names.size) clientUploads.push({ names, time: new Date(s.created_at).getTime() })
        }
      } else {
        let text = raw.slice(REPLY_TAG.length).replace(/^[\s:,-]+/, '')
        text = cleanText(text)
        messages.push({
          gid: s.gid,
          side: 'branday',
          author: (s.created_by && s.created_by.name) || 'Branday',
          text,
          created_at: s.created_at,
        })
      }
    }
    messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    // --- 2) Attachments, filtered to client-facing only ---
    let attachments = []
    try {
      const attRes = await asanaGet(
        `/attachments?parent=${id}&opt_fields=name,download_url,view_url,permanent_url,resource_subtype,host,created_at`,
        token
      )
      if (attRes.ok) {
        const all = (await attRes.json()).data || []
        attachments = all
          .filter(a => {
            if (allowedGids.has(a.gid)) return true
            if (a.name && a.created_at) {
              const t = new Date(a.created_at).getTime()
              return clientUploads.some(cu => cu.names.has(a.name) && Math.abs(t - cu.time) < UPLOAD_WINDOW_MS)
            }
            return false
          })
          .map(a => ({
            gid: a.gid,
            name: a.name || 'Attachment',
            url: a.download_url || a.view_url || a.permanent_url || null,
            is_image: !!a.name && IMAGE_RE.test(a.name),
            created_at: a.created_at,
          }))
          .filter(a => a.url)
        attachments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }
    } catch (e) {
      console.error('Error fetching attachments:', e)
    }

    return res.status(200).json({ messages, attachments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
