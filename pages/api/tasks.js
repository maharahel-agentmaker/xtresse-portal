const ASANA_API = 'https://app.asana.com/api/1.0'
const PROJECT_ID = process.env.NEXT_PUBLIC_ASANA_PROJECT_ID
const API_TOKEN = process.env.ASANA_API_TOKEN

// Only the custom-field sub-properties the UI actually renders.
// Crucially this omits `custom_fields.enum_options`, which Asana otherwise
// returns in full for every enum field on every task/subtask — the main
// cause of the response ballooning past Asana/Vercel's ~4.5MB limit.
const CF = 'custom_fields.gid,custom_fields.name,custom_fields.display_value,custom_fields.text_value,custom_fields.number_value,custom_fields.enum_value.name'

const TASK_FIELDS = `gid,name,notes,completed,due_on,assignee.name,tags.name,num_subtasks,created_at,modified_at,${CF}`
const SUBTASK_FIELDS = `gid,name,notes,completed,due_on,assignee.name,num_subtasks,created_at,modified_at,${CF}`

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
            `/sections/${section.gid}/tasks?opt_fields=${TASK_FIELDS}`
          )
          return { section, tasks: tasksData.data || [] }
        })
      )

      // Flatten with section info attached to each task
      let allTasks = tasksBySection.flatMap(({ section, tasks }) =>
        tasks.map((task) => ({ ...task, section }))
      )

      // Fetch subtasks only for tasks that have them
      allTasks = await Promise.all(
        allTasks.map(async (task) => {
          if (task.num_subtasks > 0) {
            const subtasksData = await asanaFetch(
              `/tasks/${task.gid}/subtasks?opt_fields=${SUBTASK_FIELDS}`
            )
            return { ...task, subtasks: subtasksData.data || [] }
          }
          return { ...task, subtasks: [] }
        })
      )

      res.status(200).json({ tasks: allTasks, sections })
    } else if (req.method === 'POST') {
      const { name, description, sectionGid } = req.body
      const data = await asanaFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          data: { name, notes: description, projects: [PROJECT_ID] },
        }),
      })

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
