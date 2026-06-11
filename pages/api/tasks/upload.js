// Uploads a file as an attachment on an Asana task.
// The multipart body is assembled from raw Buffers (the file bytes are NEVER
// turned into a string), so binary files — docx, xlsx, pdf, etc. — upload
// intact, not just images.

// NOTE: Vercel caps a serverless function's request body at 4.5 MB and rejects
// anything larger before this code runs. The file arrives base64-encoded (~33%
// larger than the raw file), so the real safe limit is ~3 MB per file. The
// browser enforces a 3 MB cap before sending; this value is just a backstop.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { taskGid, fileName, fileBuffer, fileType } = req.body

    if (!taskGid || !fileName || !fileBuffer) {
      return res.status(400).json({ error: 'taskGid, fileName, and fileBuffer are required' })
    }

    const ASANA_TOKEN = process.env.ASANA_API_TOKEN
    if (!ASANA_TOKEN) {
      return res.status(500).json({ error: 'ASANA_API_TOKEN not configured' })
    }

    // Decode the base64 payload into raw bytes (kept as a Buffer throughout)
    const fileBytes = Buffer.from(fileBuffer, 'base64')
    const contentType = fileType || 'application/octet-stream'
    const safeName = String(fileName).replace(/"/g, '')

    // Hand-build multipart/form-data using Buffers so binary data is preserved.
    const boundary = '----HugelPortalBoundary' + Date.now().toString(16)
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
      'utf8'
    )
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const body = Buffer.concat([header, fileBytes, footer])

    const attachmentUrl = `https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`
    const response = await fetch(attachmentUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ASANA_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    })

    const responseText = await response.text()

    if (!response.ok) {
      let details = responseText
      try { details = JSON.parse(responseText) } catch (e) { /* not JSON */ }
      console.error('[Upload] Asana error', response.status, details)
      return res.status(response.status).json({
        error: 'Failed to attach file to Asana task',
        details,
        asanaStatus: response.status,
        fileName: safeName,
      })
    }

    let attachment
    try { attachment = JSON.parse(responseText) } catch (e) {
      return res.status(500).json({ error: 'Failed to parse Asana response', message: e.message })
    }

    return res.status(200).json({
      success: true,
      attachment: attachment.data,
      fileName: safeName,
    })
  } catch (error) {
    console.error('[Upload] Exception:', error.message)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
