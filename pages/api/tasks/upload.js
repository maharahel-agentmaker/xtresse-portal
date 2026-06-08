export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
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
      console.error('[Upload] Missing required fields:', { taskGid: !!taskGid, fileName: !!fileName, fileBuffer: !!fileBuffer })
      return res.status(400).json({ error: 'taskGid, fileName, and fileBuffer are required' })
    }

    const ASANA_TOKEN = process.env.ASANA_API_TOKEN
    if (!ASANA_TOKEN) {
      console.error('[Upload] ASANA_API_TOKEN not configured')
      return res.status(500).json({ error: 'ASANA_API_TOKEN not configured' })
    }

    console.log(`[Upload] Starting upload: ${fileName}`)
    console.log(`[Upload] Task GID: ${taskGid}`)
    console.log(`[Upload] File type: ${fileType}`)

    // Convert base64 to Buffer
    const buffer = Buffer.from(fileBuffer, 'base64')
    console.log(`[Upload] Buffer size: ${buffer.length} bytes`)

    // Build multipart form data manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 16)
    
    const multipartBody = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      `Content-Type: ${fileType || 'application/octet-stream'}`,
      '',
      buffer.toString('binary'),
      `--${boundary}--`
    ].join('\r\n')

    const multipartBuffer = Buffer.from(multipartBody, 'binary')

    const attachmentUrl = `https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`

    console.log(`[Upload] Sending to Asana: ${attachmentUrl}`)

    const response = await fetch(attachmentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASANA_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBuffer.length
      },
      body: multipartBuffer
    })

    console.log(`[Upload] Asana response status: ${response.status}`)

    const responseText = await response.text()
    console.log(`[Upload] Asana response: ${responseText.substring(0, 200)}...`)

    if (!response.ok) {
      let error = { message: responseText }
      try {
        error = JSON.parse(responseText)
      } catch (e) {
        // response is not JSON
      }
      console.error('[Upload] Asana error:', error)
      return res.status(response.status).json({ 
        error: 'Failed to attach file to Asana task',
        details: error,
        asanaStatus: response.status
      })
    }

    let attachment
    try {
      attachment = JSON.parse(responseText)
    } catch (e) {
      console.error('[Upload] Failed to parse response:', e.message)
      return res.status(500).json({
        error: 'Failed to parse Asana response',
        message: e.message
      })
    }

    console.log(`[Upload] Success! Attachment GID: ${attachment.data?.gid}`)

    return res.status(200).json({
      success: true,
      attachment: attachment.data,
      fileName: fileName,
      message: 'File successfully attached to task'
    })

  } catch (error) {
    console.error('[Upload] Exception:', error.message)
    console.error('[Upload] Stack:', error.stack)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}