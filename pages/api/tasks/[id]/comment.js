export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { text } = req.body

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required' })
  }

  if (!id) {
    return res.status(400).json({ error: 'Task ID is required' })
  }

  try {
    const asanaToken = process.env.ASANA_API_TOKEN

    if (!asanaToken) {
      console.error('ASANA_API_TOKEN is not set')
      return res.status(500).json({ error: 'API token not configured' })
    }

    // Post comment to Asana
    const response = await fetch(`https://app.asana.com/api/1.0/tasks/${id}/stories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${asanaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          text: text
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Asana API error:', error)
      return res.status(response.status).json({ 
        error: 'Failed to post comment to Asana',
        details: error 
      })
    }

    const data = await response.json()
    return res.status(201).json({ 
      success: true, 
      story: data.data 
    })

  } catch (error) {
    console.error('Error posting comment:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
}
