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
  try {
    if (req.method === 'POST') {
      const { taskId, text } = req.body

      const data = await asanaFetch(`/tasks/${taskId}/stories`, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            text: text,
          },
        }),
      })

      res.status(201).json(data.data)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Asana API error:', error)
    res.status(500).json({ error: error.message })
  }
}
