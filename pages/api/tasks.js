const ASANA_API = 'https://app.asana.com/api/1.0'
const PROJECT_ID = process.env.NEXT_PUBLIC_ASANA_PROJECT_ID
const API_TOKEN = process.env.ASANA_API_TOKEN

// Only these custom fields are shown to clients in the portal — list columns AND the
// task/subtask detail grids. Anything NOT in this list (including any field added in
// Asana later) is filtered out here at the source, so it never reaches the portal.
const CLIENT_VISIBLE_FIELDS = [
  'Stage',
  'Date Submitted',
  'Requested Due Date',
  'Asset Type',
  'Client Deliverable Location',
  'First Iteration',
  '2nd Iteration',
]

function clientFields(customFields) {
  if (!Array.isArray(customFields)) return []
  return customFields.filter((f) => f && CLIENT_VISIBLE_FIELDS.includes(f.name))
}

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
    if (req.method === 'GET') {
      // Fetch all sections in the project
      const sectionsData = await asanaFetch(`/projects/${PROJECT_ID}/sections?opt_fields=gid,name`)
      const sections = sectionsData.data || []

      // Fetch tasks per section to preserve order
      const tasksBySection = await Promise.all(
        sections.map(async (section) => {
          const tasksData = await asanaFetch(
            `/sections/${section.gid}/tasks?opt_fields=gid,name,notes,completed,completed_at,due_on,due_at,start_on,assignee.name,assignee.email,tags.name,num_subtasks,custom_fields,memberships.section.name,followers.name,created_at,modified_at`
          )
          return {
            section,
            tasks: tasksData.data || [],
          }
        })
      )

      // Flatten with section info attached to each task, and fetch subtasks
      let allTasks = tasksBySection.flatMap(({ section, tasks }) =>
        tasks.map((task) => ({ ...task, section, custom_fields: clientFields(task.custom_fields) }))
      )

      // Fetch subtasks for each task with all fields
      allTasks = await Promise.all(
        allTasks.map(async (task) => {
          if (task.num_subtasks > 0) {
            const subtasksData = await asanaFetch(
              `/tasks/${task.gid}/subtasks?opt_fields=gid,name,notes,completed,due_on,start_on,assignee.name,tags.name,num_subtasks,custom_fields,created_at,modified_at`
            )
            return {
              ...task,
              subtasks: (subtasksData.data || []).map((st) => ({ ...st, custom_fields: clientFields(st.custom_fields) }))
            }
          }
          return {
            ...task,
            subtasks: []
          }
        })
      )

      res.status(200).json({ tasks: allTasks, sections })
    } else if (req.method === 'POST') {
      const { name, description, sectionGid } = req.body
      const data = await asanaFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            name,
            notes: description,
            projects: [PROJECT_ID],
          },
        }),
      })

      // Move to section if specified
      if (sectionGid && data.data?.gid) {
        await asanaFetch(`/sections/${sectionGid}/addTask`, {
          method: 'POST',
          body: JSON.stringify({ data: { task: data.data.gid } }),
        })
      }

      res.status(201).json(data.data)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Asana API error:', error)
    res.status(500).json({ error: error.message })
  }
}
