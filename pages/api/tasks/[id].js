const ASANA_API = 'https://app.asana.com/api/1.0'
const API_TOKEN = process.env.ASANA_API_TOKEN

async function asanaFetch(path, options = {}) {
  const res = await fetch(`${ASANA_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res.json()
}

export default async function handler(req, res) {
  const { id } = req.query

  try {
    if (req.method === 'GET') {
      const data = await asanaFetch(`/tasks/${id}?opt_fields=gid,name,notes,completed,due_on,start_on,assignee.name,custom_fields`)
      res.status(200).json(data.data)
    } else if (req.method === 'PUT') {
      const { name, description, completed, clientFeedback } = req.body

      const updateData = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.notes = description
      if (completed !== undefined) updateData.completed = completed
      
      // If client feedback is provided, append it to notes
      if (clientFeedback) {
        const currentNotes = description || ''
        updateData.notes = currentNotes + (currentNotes ? '\n\n' : '') + `[Client Feedback: ${new Date().toLocaleDateString()}]\n${clientFeedback}`
      }

      const data = await asanaFetch(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ data: updateData }),
      })

      res.status(200).json(data.data)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Asana API error:', error)
    res.status(500).json({ error: error.message })
  }
}
