// GET /api/tasks/[id]/comments
// Returns client-facing messages for a task PLUS only client-facing files.
// A file shows to the client when it is part of a client-facing exchange:
//   • a file Branday attached to an @client comment (ANY type), or
//   • a file the client uploaded through the portal ([Client Feedback]).
// Internal attachments (working files, pasted screenshots, Figma links) stay hidden.
//
// Matching a file to a client-facing comment:
//   1) it is referenced inline in the comment markup (pasted images), and/or
//   2) it was attached around a client-facing comment by the same person — files
//      land seconds before the comment posts. Each file ties to the NEAREST
//      same-author comment and shows only if that comment is client-facing, so an
//      internal file tied to an internal comment stays hidden.

const ASANA_API = 'https://app.asana.com/api/1.0'

const CLIENT_TAG = '[client feedback]'
const REPLY_TAG = '@client'

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i
const ASSET_PATTERNS = [
  /get_asset\?asset_id=(\d+)/g,
  /data-asana-gid="(\d+)"/g,
  /\/get_asset\/(\d+)/g,
]
const ASSET_URL_RE = /https?:\/\/app\.asana\.com\/\S*get_asset\?asset_id=\d+/g
const UPLOAD_WINDOW_MS = 10 * 60 * 1000  // name+time match for portal uploads
const ASSOC_BACK_MS = 2 * 60 * 1000      // a file may post just after its comment
const ASSOC_FWD_MS = 10 * 60 * 1000      // ...or up to 10 min before the comment

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
    const allowedGids = new Set()
    const clientUploads = []
    const commentTimeline = []   // every comment: { time, author, clientFacing }

    for (const s of stories) {
      if (s.type !== 'comment' || !s.text) continue
      const raw = s.text.trim()
      const lower = raw.toLowerCase()
      const isClient = lower.startsWith(CLIENT_TAG)
      const isReply = lower.startsWith(REPLY_TAG)
      const author = (s.created_by && s.created_by.name) || ''

      commentTimeline.push({
        time: new Date(s.created_at).getTime(),
        author,
        clientFacing: isClient || isReply,
      })

      if (!isClient && !isReply) continue

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
          author: author || 'Branday',
          text,
          created_at: s.created_at,
        })
      }
    }
    messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    commentTimeline.sort((a, b) => a.time - b.time)

    // Tie a file to the nearest same-author comment; client-facing => show it.
    function tiedToClientFacingComment(att) {
      if (!att.created_at) return false
      const author = (att.created_by && att.created_by.name) || ''
      if (!author) return false
      const t = new Date(att.created_at).getTime()
      let best = null
      for (const c of commentTimeline) {
        if (c.author !== author) continue
        if (c.time < t - ASSOC_BACK_MS || c.time > t + ASSOC_FWD_MS) continue
        if (best === null || Math.abs(c.time - t) < Math.abs(best.time - t)) best = c
      }
      return best ? best.clientFacing : false
    }

    function isClientUploadName(att) {
      if (!att.name || !att.created_at) return false
      const t = new Date(att.created_at).getTime()
      return clientUploads.some(cu => cu.names.has(att.name) && Math.abs(t - cu.time) < UPLOAD_WINDOW_MS)
    }

    // --- 2) Attachments, filtered to client-facing only ---
    let attachments = []
    try {
      const attRes = await asanaGet(
        `/attachments?parent=${id}&opt_fields=name,download_url,view_url,permanent_url,resource_subtype,host,created_at,created_by.name`,
        token
      )
      if (attRes.ok) {
        const all = (await attRes.json()).data || []
        attachments = all
          .filter(a => {
            try {
              return allowedGids.has(a.gid) || tiedToClientFacingComment(a) || isClientUploadName(a)
            } catch (e) {
              return allowedGids.has(a.gid)
            }
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
